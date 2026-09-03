import type { ExpoConfig } from 'expo/config';
import palette from './src/constants/palette';

const config: ExpoConfig = {
  name: 'RideSync',
  slug: 'RideSync',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'ridesync',
  userInterfaceStyle: 'dark',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.shreyg4.RideSync',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    predictiveBackGestureEnabled: false,
    package: 'com.shreyg4.RideSync',
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow $(PRODUCT_NAME) to access your photos to set a profile picture.',
      },
    ],
    [
      '@react-native-community/datetimepicker',
      {
        android: {
          datePicker: {
            windowBackground: { light: palette.gray900, dark: palette.gray900 },
            colorAccent: { light: palette.blue5, dark: palette.blue5 },
            textColorPrimary: { light: palette.white, dark: palette.white },
            textColorSecondary: { light: palette.gray300, dark: palette.gray300 },
          },
          timePicker: {
            background: { light: palette.gray900, dark: palette.gray900 },
            numbersTextColor: { light: palette.blue5, dark: palette.blue5 },
          },
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'c0b94e21-464e-4987-ba61-a79982161cc3',
    },
  },
  owner: 'shreyg4',
};

export default config;
