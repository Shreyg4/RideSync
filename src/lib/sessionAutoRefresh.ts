/**
 * @file sessionAutoRefresh.ts
 * @description Ties supabase-js's token refresh ticker to the app's foreground state,
 * so the access token stays fresh while the app is in use and no timer runs behind it.
 */
import { AppState, Platform, type AppStateStatus } from 'react-native';
import type { AppSupabaseClient } from './createSupabaseClient';

const noop = () => {};

export const registerSessionAutoRefresh = (client: AppSupabaseClient) => {
  if (Platform.OS === 'web') return noop;

  // Anything but 'active' (background, or inactive) pauses refreshing
  const sync = (status: AppStateStatus) => {
    if (status === 'active') {
      client.auth.startAutoRefresh();
    } else {
      client.auth.stopAutoRefresh();
    }
  };

  // 'change' only fires on transitions, so prime with whatever state we start in
  sync(AppState.currentState);
  const subscription = AppState.addEventListener('change', sync);

  // Teardown for tests; the app singleton lives for the process and discards this
  return () => subscription.remove();
};
