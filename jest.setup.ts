/* eslint-disable @typescript-eslint/no-require-imports */
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

// The real createURL reads the scheme from the app manifest, which Jest never loads.
jest.mock('expo-linking', () => ({
  createURL: (path: string) => `ridesync://${path}`,
}));

// The real package needs native modules. Map pieces render as plain Views so a test can find them
// and read their props
const mockSetCamera = jest.fn();
jest.mock('@rnmapbox/maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Camera = React.forwardRef((props: object, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ setCamera: mockSetCamera }));
    return React.createElement(View, { testID: 'mapbox-camera', ...props });
  });
  Camera.displayName = 'MockCamera';
  const mapbox = {
    MapView: (props: object) => React.createElement(View, { testID: 'mapbox-map', ...props }),
    // Tests read what the camera was told to do through __camera.setCamera
    Camera,
    __camera: { setCamera: mockSetCamera },
    MarkerView: (props: object) => React.createElement(View, { testID: 'mapbox-marker', ...props }),
    StyleURL: { Dark: 'mapbox://styles/mapbox/dark-v10' },
    setAccessToken: jest.fn(async () => null),
  };
  return { __esModule: true, ...mapbox, default: mapbox };
});

// The library's own mocks for its native module, so components using gestures can render
require('react-native-gesture-handler/jestSetup');

// The real row needs Reanimated's native side. This one renders the row and its revealed actions
// together, and a hidden button per row stands in for the swipe that opens it
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  type MockSwipeableProps = {
    children?: React.ReactNode;
    renderRightActions?: (progress: unknown, translation: unknown, methods: unknown) => unknown;
    onSwipeableWillOpen?: (direction: string) => void;
    onSwipeableWillClose?: (direction: string) => void;
    testID?: string;
  };
  const Swipeable = React.forwardRef((props: MockSwipeableProps, ref: unknown) => {
    const latest = React.useRef(props);
    latest.current = props;
    const methods = React.useMemo(
      () => ({
        openRight: jest.fn(() => latest.current.onSwipeableWillOpen?.('left')),
        close: jest.fn(() => latest.current.onSwipeableWillClose?.('left')),
        openLeft: jest.fn(),
        reset: jest.fn(),
      }),
      []
    );
    React.useImperativeHandle(ref, () => methods, [methods]);
    return React.createElement(
      View,
      { testID: props.testID },
      props.children,
      props.renderRightActions?.({ value: 1 }, { value: 0 }, methods),
      React.createElement(Pressable, {
        testID: props.testID ? `${props.testID}-swipe` : undefined,
        onPress: methods.openRight,
      })
    );
  });
  Swipeable.displayName = 'MockReanimatedSwipeable';
  return { __esModule: true, default: Swipeable };
});

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
      dismissTo: jest.fn(),
    },
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    // Runs the callback once on mount, the way a screen's first focus would.
    useFocusEffect: (effect: React.EffectCallback) => React.useEffect(effect, [effect]),
    // An object href ({ pathname, params }) prints as JSON so a test can read its params
    Redirect: ({ href }: { href: unknown }) =>
      React.createElement(
        Text,
        { testID: 'redirect' },
        typeof href === 'string' ? href : JSON.stringify(href)
      ),
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
