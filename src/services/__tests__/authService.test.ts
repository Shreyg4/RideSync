// authService is the only file that touches supabase.auth, so these pin the exact calls it makes
// and that every failure reaches the caller instead of passing for success.

import { describe, expect, it, jest } from '@jest/globals';
import {
  deleteAccount,
  getSession,
  onAuthStateChange,
  resendVerification,
  signIn,
  signOut,
  signUp,
  verifyEmail,
} from '../authService';
import { mockRpc, mockSupabase } from '@/src/test/supabase';

const { auth, functions } = mockSupabase;
const authError = { code: 'invalid_credentials', message: 'Invalid login credentials' };
const session = { access_token: 'token', user: { id: 'user-1' } };

describe('getSession', () => {
  it('returns the stored session', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    await expect(getSession()).resolves.toBe(session);
  });

  it('returns null when no one is signed in', async () => {
    await expect(getSession()).resolves.toBeNull();
  });

  it('throws when the stored session cannot be read', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: authError });
    await expect(getSession()).rejects.toBe(authError);
  });
});

describe('onAuthStateChange', () => {
  it('passes every auth event on to the handler', () => {
    const handler = jest.fn();
    onAuthStateChange(handler);

    const listener = auth.onAuthStateChange.mock.calls[0][0] as (...args: unknown[]) => void;
    listener('SIGNED_IN', session);

    expect(handler).toHaveBeenCalledWith('SIGNED_IN', session);
  });

  it('returns a function that unsubscribes the listener', () => {
    const subscription = { unsubscribe: jest.fn<() => void>() };
    auth.onAuthStateChange.mockReturnValueOnce({ data: { subscription } });

    const unsubscribe = onAuthStateChange(jest.fn());
    expect(subscription.unsubscribe).not.toHaveBeenCalled();

    unsubscribe();

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('signUp', () => {
  it('first clears any unfinished sign-up holding the email or username, so a retry starts fresh', async () => {
    await signUp('Ana', 'Lee', 'ana_lee', 'ana@example.com', 'hunter22');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('release_unconfirmed_signup', {
      email_address: 'ana@example.com',
      wanted_username: 'ana_lee',
    });
    expect(mockSupabase.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      auth.signUp.mock.invocationCallOrder[0]
    );
  });

  it('does not sign up when the unfinished sign-up could not be cleared', async () => {
    const releaseError = { code: 'PGRST301', message: 'JWT expired' };
    mockRpc('release_unconfirmed_signup', { error: releaseError });

    await expect(signUp('Ana', 'Lee', 'ana_lee', 'ana@example.com', 'hunter22')).rejects.toBe(
      releaseError
    );
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('sends the names and username as user metadata, for the new-user trigger to copy', async () => {
    await signUp('Ana', 'Lee', 'ana_lee', 'ana@example.com', 'hunter22');

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'hunter22',
      options: { data: { first_name: 'Ana', last_name: 'Lee', username: 'ana_lee' } },
    });
  });

  it('returns the new user, still needing its email confirmed when no session came back', async () => {
    const user = { id: 'user-1', identities: [{ id: 'identity-1' }] };
    auth.signUp.mockResolvedValueOnce({ data: { user, session: null }, error: null });

    await expect(signUp('Ana', 'Lee', 'ana_lee', 'ana@example.com', 'hunter22')).resolves.toEqual({
      user,
      needsVerification: true,
    });
  });

  it('needs no verification when the project signs the user straight in', async () => {
    const user = { id: 'user-1', identities: [{ id: 'identity-1' }] };
    auth.signUp.mockResolvedValueOnce({ data: { user, session }, error: null });

    await expect(signUp('Ana', 'Lee', 'ana_lee', 'ana@example.com', 'hunter22')).resolves.toEqual({
      user,
      needsVerification: false,
    });
  });

  it('says the email is taken when Supabase answers with a stand-in user that gets no code', async () => {
    const user = { id: 'fake', identities: [] };
    auth.signUp.mockResolvedValueOnce({ data: { user, session: null }, error: null });

    await expect(
      signUp('Ana', 'Lee', 'ana_lee', 'ana@example.com', 'hunter22')
    ).rejects.toMatchObject({ code: 'user_already_exists' });
  });

  it('throws the sign-up error', async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: authError });

    await expect(signUp('Ana', 'Lee', 'ana_lee', 'ana@example.com', 'hunter22')).rejects.toBe(
      authError
    );
  });
});

describe('verifyEmail', () => {
  it('checks the emailed code for that address and returns the confirmed user', async () => {
    const user = { id: 'user-1' };
    auth.verifyOtp.mockResolvedValueOnce({ data: { user, session }, error: null });

    await expect(verifyEmail('ana@example.com', '123456')).resolves.toBe(user);
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('throws a wrong or expired code', async () => {
    const codeError = { code: 'otp_expired', message: 'Token has expired or is invalid' };
    auth.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: codeError });

    await expect(verifyEmail('ana@example.com', '000000')).rejects.toBe(codeError);
  });
});

describe('resendVerification', () => {
  it('sends a new sign-up code to that address', async () => {
    await expect(resendVerification('ana@example.com')).resolves.toBeUndefined();
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'ana@example.com' });
  });

  it('throws when the code cannot be sent', async () => {
    const sendError = { code: 'over_email_send_rate_limit', message: 'rate limited' };
    auth.resend.mockResolvedValueOnce({ data: null, error: sendError });

    await expect(resendVerification('ana@example.com')).rejects.toBe(sendError);
  });
});

describe('signIn', () => {
  it('signs in with email and password', async () => {
    await expect(signIn('ana@example.com', 'hunter22')).resolves.toBeUndefined();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'hunter22',
    });
  });

  it('throws the sign-in error', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError,
    });

    await expect(signIn('ana@example.com', 'wrong')).rejects.toBe(authError);
  });
});

describe('signOut', () => {
  it('signs out this device only', async () => {
    await expect(signOut()).resolves.toBeUndefined();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('throws the sign-out error', async () => {
    auth.signOut.mockResolvedValueOnce({ data: null, error: authError });
    await expect(signOut()).rejects.toBe(authError);
  });
});

describe('deleteAccount', () => {
  it('has the delete-account function delete the account, then clears the local session', async () => {
    await expect(deleteAccount()).resolves.toBeUndefined();

    expect(functions.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(functions.invoke.mock.invocationCallOrder[0]).toBeLessThan(
      auth.signOut.mock.invocationCallOrder[0]
    );
  });

  it('stays signed in when the function fails, since the account still exists', async () => {
    const functionError = new Error('Edge Function returned a non-2xx status code');
    functions.invoke.mockResolvedValueOnce({ data: null, error: functionError });

    await expect(deleteAccount()).rejects.toBe(functionError);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('throws when the local sign-out fails', async () => {
    auth.signOut.mockResolvedValueOnce({ data: null, error: authError });
    await expect(deleteAccount()).rejects.toBe(authError);
  });
});
