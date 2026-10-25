// The auth options are the app's whole session policy in one place, so each one is pinned:
// a quiet change here would stop logins persisting, or drop PKCE, with nothing else failing.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseClient, type SessionStorage } from '../createSupabaseClient';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ fake: 'client' })) }));

const URL = 'https://test.supabase.co';
const ANON_KEY = 'test-anon-key';
const storage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
} as unknown as SessionStorage;

const optionsPassed = () => jest.mocked(createClient).mock.calls[0][2];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createSupabaseClient', () => {
  it(`sets the app's session policy and nothing else`, () => {
    createSupabaseClient({ url: URL, anonKey: ANON_KEY, storage, detectSessionInUrl: false });

    expect(createClient).toHaveBeenCalledWith(URL, ANON_KEY, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  });

  it('keeps the session in the storage it was given, not a default', () => {
    createSupabaseClient({ url: URL, anonKey: ANON_KEY, storage, detectSessionInUrl: false });

    expect(optionsPassed()?.auth?.storage).toBe(storage);
  });

  it.each([true, false])('passes detectSessionInUrl: %s through', (detectSessionInUrl) => {
    createSupabaseClient({ url: URL, anonKey: ANON_KEY, storage, detectSessionInUrl });

    expect(optionsPassed()?.auth?.detectSessionInUrl).toBe(detectSessionInUrl);
  });

  it('returns the client supabase-js built', () => {
    const client = createSupabaseClient({
      url: URL,
      anonKey: ANON_KEY,
      storage,
      detectSessionInUrl: false,
    });

    expect(client).toBe(jest.mocked(createClient).mock.results[0].value);
  });
});
