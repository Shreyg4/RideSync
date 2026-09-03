import FontAwesome from '@expo/vector-icons/FontAwesome';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/src/context/AuthProvider';
import { reportError } from '@/src/lib/logger';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete. It rejects if
// the splash screen is already gone, which is survivable - but an unhandled rejection here is
// invisible, so it goes through the logger instead.
SplashScreen.preventAutoHideAsync().catch((error) =>
  reportError(error, { scope: 'RootLayout.preventAutoHide' })
);

export default function RootLayout() {
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

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync().catch((error) =>
      reportError(error, { scope: 'RootLayoutNav.hideSplash' })
    );
  }, [loading]);

  return (
    <KeyboardProvider>
      <ThemeProvider value={DarkTheme}>
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
