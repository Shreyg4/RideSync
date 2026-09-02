import { AppState, Platform, type AppStateStatus } from 'react-native';
import type { AppSupabaseClient } from './createSupabaseClient';

const noop = () => {};

export const registerSessionAutoRefresh = (client: AppSupabaseClient) => {
  if (Platform.OS === 'web') return noop;

  const sync = (status: AppStateStatus) => {
    if (status === 'active') {
      client.auth.startAutoRefresh();
    } else {
      client.auth.stopAutoRefresh();
    }
  };

  sync(AppState.currentState);
  const subscription = AppState.addEventListener('change', sync);

  return () => subscription.remove();
};
