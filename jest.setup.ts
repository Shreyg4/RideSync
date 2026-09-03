import { afterEach, beforeEach, jest } from '@jest/globals';
import { cleanup } from '@testing-library/react-native';
import * as supabaseModule from '@/src/lib/supabase';

process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'test-anon-key';

jest.mock('@/src/lib/supabase');

jest.mock('@react-native-async-storage/async-storage', () => {
  const mock = require('@react-native-async-storage/async-storage/jest');
  return { __esModule: true, default: mock.default ?? mock };
});

jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest')
);

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 60,
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      dismiss: jest.fn(),
    },
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, { testID: 'redirect' }, String(href)),
    Link: ({ children }: { children: React.ReactNode }) => children,
    Stack: Object.assign(({ children }: { children?: React.ReactNode }) => children ?? null, {
      Screen: () => null,
      Protected: ({ children }: { children?: React.ReactNode }) => children ?? null,
    }),
    SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
  };
});

const supabaseMock = supabaseModule as unknown as typeof import('@/src/lib/__mocks__/supabase');

beforeEach(() => {
  supabaseMock.resetSupabaseMock();
});

afterEach(async () => {
  await cleanup();
});
