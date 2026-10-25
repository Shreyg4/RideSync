// authService is the only file that touches supabase.auth, so these pin the exact calls it makes
// and that every failure reaches the caller instead of passing for success.

import { describe, expect, it, jest } from '@jest/globals';
import {
  deleteAccount,
  getSession,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
} from '../authService';
import { mockSupabase } from '@/src/test/supabase';

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
  it('sends the names and username as user metadata, for the new-user trigger to copy', async () => {
    await signUp('Ana', 'Lee', 'ana_lee', 'ana@example.com', 'hunter22');

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'hunter22',
      options: { data: { first_name: 'Ana', last_name: 'Lee', username: 'ana_lee' } },
    });
  });

  it('returns the new user', async () => {
    const user = { id: 'user-1' };
    auth.signUp.mockResolvedValueOnce({ data: { user, session: null }, error: null });

    await expect(signUp('Ana', 'Lee', 'ana_lee', 'ana@example.com', 'hunter22')).resolves.toBe(
      user
    );
  });

  it('throws the sign-up error', async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: authError });

    await expect(signUp('Ana', 'Lee', 'ana_lee', 'ana@example.com', 'hunter22')).rejects.toBe(
      authError
    );
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
