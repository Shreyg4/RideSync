/**
 * @file authService.ts
 * @description The boundary layer between the app and Supabase's auth API
 * and is the only file that touches supabase.auth
 */
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
