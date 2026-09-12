/**
 * @file _layout.tsx
 * @description The composition root for the UI. Fonts, providers, theme, splash timing,
 * and route registration all get decided once here.
 */
import '@/src/lib/reporting';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/src/context/AuthProvider';
import { reportError } from '@/src/lib/logger';
import * as Sentry from '@sentry/react-native';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch((error) =>
  reportError(error, { scope: 'RootLayout.preventAutoHide' })
);

function RootLayout() {
  // blocks startup until fonts load
  const [loaded, error] = useFonts({
    SpaceMono: require('../../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) {
    return null;
  }

  // Entire app is wrapped in AuthProvider so all screens know current auth state
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
export default Sentry.wrap(RootLayout);

function RootLayoutNav() {
  const { session, loading } = useAuth();

  // waiting until stored session is read before showing any screen
  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync().catch((error) =>
      reportError(error, { scope: 'RootLayoutNav.hideSplash' })
    );
  }, [loading]);

  return (
    <KeyboardProvider>
      <ThemeProvider value={DarkTheme}>
        <StatusBar style="light" />
        <Stack>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(planner)" options={{ headerShown: false }} />
            <Stack.Screen
              name="createTrip"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </Stack.Protected>

          <Stack.Protected guard={!session}>
            <Stack.Screen name="(authentication)" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </KeyboardProvider>
  );
}
