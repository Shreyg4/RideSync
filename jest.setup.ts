// Runs once per test file (setupFilesAfterEnv), before the test module is evaluated.
// babel-plugin-jest-hoist lifts the jest.mock() calls above the imports, but keeps them
// below the @jest/globals import they depend on.

import { beforeEach, jest } from '@jest/globals';
import * as supabaseModule from '@/src/lib/supabase';

// Only needed for tests that pull in the real client transitively (a screen importing a
// screen, say). Real keys never belong here - these are inert placeholders that just get
// src/lib/supabase.ts past its startup guard.
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'test-anon-key';

// Jest auto-applies __mocks__ for node_modules packages but never for first-party modules,
// so the manual mock in src/lib/__mocks__/supabase.ts needs registering by hand. Doing it
// here covers every test file; a test that wants the real client can call jest.unmock().
jest.mock('@/src/lib/supabase');

// Native modules with no JS implementation under Jest. jest-expo's preset covers the
// expo-* packages, so only the non-Expo ones are listed here.
jest.mock('@react-native-async-storage/async-storage', () => {
  const mock = require('@react-native-async-storage/async-storage/jest');
  return { __esModule: true, default: mock.default ?? mock };
});

jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest')
);

// The Supabase mock is a module-level singleton, so its spies and staged results would
// otherwise leak between test cases. Not jest config's `resetMocks`: that would also wipe
// the default implementations the mock sets at import time.
const supabaseMock = supabaseModule as unknown as typeof import('@/src/lib/__mocks__/supabase');

beforeEach(() => {
  supabaseMock.resetSupabaseMock();
});
