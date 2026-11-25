/**
 * @file authService.ts
 * @description The boundary layer between the app and Supabase's auth API
 * and is the only file that touches supabase.auth
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export type AuthEvent = Parameters<Parameters<typeof supabase.auth.onAuthStateChange>[0]>[0];

// gets currently stored session once
export const getSession = async (): Promise<Session | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

// This fires on every later auth state change (sign in, sign out, and token refresh)
export const onAuthStateChange = (handler: (event: AuthEvent, session: Session | null) => void) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(handler);
  return () => subscription.unsubscribe();
};

// needsVerification is true when the project requires a confirmed email: no session comes back
// until the code emailed to the user goes through verifyEmail
export type SignUpResult = { user: User | null; needsVerification: boolean };

export const signUp = async (
  first_name: string,
  last_name: string,
  username: string,
  email: string,
  password: string
): Promise<SignUpResult> => {
  // A retry after a mistyped email, or with changed details, would otherwise trip over the first
  // attempt, which still holds the username and, for the same email, keeps its old details
  const { error: releaseError } = await supabase.rpc('release_unconfirmed_signup', {
    email_address: email,
    wanted_username: username,
  });
  if (releaseError) throw releaseError;

  const { data, error } = await supabase.auth.signUp({
    options: { data: { first_name, last_name, username } },
    email,
    password,
  });
  if (error) throw error;
  // With confirmations on, Supabase answers an email that's already registered with a stand-in
  // user that has no identities and sends no code, so the user would wait for an email that never
  // comes
  if (data.user && data.user.identities?.length === 0) {
    throw Object.assign(new Error('User already registered'), { code: 'user_already_exists' });
  }
  return { user: data.user, needsVerification: !data.session };
};

// Checks the code from the sign-up email. On success Supabase signs the user in, and
// onAuthStateChange hands the new session to AuthProvider. Resolves to the now-confirmed user
export const verifyEmail = async (email: string, code: string): Promise<User | null> => {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
  return data.user;
};

// Sends a fresh sign-up code, which replaces the last one
export const resendVerification = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
};

// Supabase makes a new reset code on every send and the old one stops working, so the app remembers
// the last code it sent and doesn't ask for another until the user wants one. Kept in storage so
// it holds across restarts
const LAST_RESET_KEY = 'passwordReset.lastSent';
// Codes last an hour (otp_expiry). An older code is replaced so the user isn't handed one about to die
const RESET_CODE_REUSE_MS = 50 * 60 * 1000;

const forgetResetCode = async () => {
  try {
    await AsyncStorage.removeItem(LAST_RESET_KEY);
  } catch {
    // Nothing to undo: the next request just sends a fresh code
  }
};

const hasLiveResetCode = async (email: string): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_RESET_KEY);
    if (!raw) return false;
    const last = JSON.parse(raw) as { email?: unknown; sentAt?: unknown };
    return (
      last.email === email &&
      typeof last.sentAt === 'number' &&
      Date.now() - last.sentAt < RESET_CODE_REUSE_MS
    );
  } catch {
    return false;
  }
};

// Always emails a new reset code, replacing any earlier one. Used when the user asks for a new code.
// Supabase answers the same whether or not the email has an account, so this can't be used to find
// out who's signed up
export const sendPasswordReset = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
  try {
    await AsyncStorage.setItem(LAST_RESET_KEY, JSON.stringify({ email, sentAt: Date.now() }));
  } catch {
    // Not remembering it only means the next request sends another code
  }
};

// Starts a reset from the forgot-password screen. If a code already went to this email and is still
// good, it's left alone so the one in the inbox keeps working; otherwise a code is sent
export const requestPasswordReset = async (email: string): Promise<void> => {
  if (await hasLiveResetCode(email)) return;
  await sendPasswordReset(email);
};

// Checks the code from the reset email. Supabase signs the user in so the password can be changed,
// announcing it as PASSWORD_RECOVERY, which AuthProvider holds back until the new password is saved.
// A code works once, so it's forgotten after going through
export const verifyPasswordReset = async (email: string, code: string): Promise<void> => {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
  if (error) throw error;
  await forgetResetCode();
};

// Changes the signed-in user's password. After a reset, this is what lets the user into the app
export const updatePassword = async (password: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
};

export const signIn = async (email: string, password: string): Promise<void> => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
};

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
};

export const deleteAccount = async (): Promise<void> => {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;

  // The session is already dead on the server; this clears encrypted storage and fires SIGNED_OUT
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
  if (signOutError) throw signOutError;
};
