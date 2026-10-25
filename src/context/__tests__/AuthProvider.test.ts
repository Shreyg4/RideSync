// AuthProvider is the app's one answer to "who is signed in", so these check it never claims
// an answer before it has one, follows every auth event, and stops listening when it unmounts.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { setErrorReporter } from '@/src/lib/logger';
import * as authService from '@/src/services/authService';
import { mockSupabase } from '@/src/test/supabase';
import { AuthProvider, useAuth } from '../AuthProvider';

const { auth } = mockSupabase;

type SessionResult = { data: { session: unknown }; error: unknown };
type AuthListener = (event: string, session: unknown) => void;

const session = { access_token: 'token', user: { id: 'user-1' } };

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const renderAuth = () => renderHook(() => useAuth(), { wrapper: AuthProvider });

// The callback AuthProvider handed to supabase.auth.onAuthStateChange
const authListener = () => auth.onAuthStateChange.mock.calls[0][0] as AuthListener;

let reporter: jest.Mock;

beforeEach(() => {
  reporter = jest.fn();
  setErrorReporter(reporter);
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  setErrorReporter(null);
});

describe('AuthProvider', () => {
  it('stays loading until the stored session has been read', async () => {
    const stored = deferred<SessionResult>();
    auth.getSession.mockReturnValueOnce(stored.promise);
    const { result } = await renderAuth();

    expect(result.current).toMatchObject({ loading: true, session: null, user: null });

    await act(async () => stored.resolve({ data: { session }, error: null }));

    expect(result.current).toMatchObject({ loading: false, session, user: session.user });
  });

  it('finishes loading signed out when nothing is stored', async () => {
    const { result } = await renderAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ session: null, user: null });
  });

  it('reports a failed session read and finishes loading signed out', async () => {
    const readError = { code: 'unexpected_failure', message: 'storage unavailable' };
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: readError });
    const { result } = await renderAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ session: null, user: null });
    expect(reporter).toHaveBeenCalledWith(readError, { scope: 'AuthProvider.initializeSession' });
  });

  it('follows sign-in and sign-out events', async () => {
    const { result } = await renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => authListener()('SIGNED_IN', session));
    expect(result.current).toMatchObject({ session, user: session.user });

    await act(async () => authListener()('SIGNED_OUT', null));
    expect(result.current).toMatchObject({ session: null, user: null });
  });

  it('stops loading on an auth event even while the stored read is still pending', async () => {
    auth.getSession.mockReturnValueOnce(deferred<SessionResult>().promise);
    const { result } = await renderAuth();

    await act(async () => authListener()('INITIAL_SESSION', session));

    expect(result.current).toMatchObject({ loading: false, session });
  });

  it('subscribes once, not on every render', async () => {
    const { rerender } = await renderAuth();

    await rerender({});

    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes when it unmounts', async () => {
    const subscription = { unsubscribe: jest.fn<() => void>() };
    auth.onAuthStateChange.mockReturnValueOnce({ data: { subscription } });
    const { unmount } = await renderAuth();
    expect(subscription.unsubscribe).not.toHaveBeenCalled();

    await unmount();

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('hands out the auth service actions', async () => {
    const { result } = await renderAuth();

    expect(result.current).toMatchObject({
      signIn: authService.signIn,
      signUp: authService.signUp,
      signOut: authService.signOut,
      deleteAccount: authService.deleteAccount,
    });
  });
});

describe('useAuth', () => {
  it('throws when used outside AuthProvider', async () => {
    await expect(renderHook(() => useAuth())).rejects.toThrow(
      'useAuth must be used within AuthProvider'
    );
  });
});
