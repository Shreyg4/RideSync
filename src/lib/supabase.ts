import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { encryptedStorage } from './encryptedStorage';
import { createSupabaseClient } from './createSupabaseClient';
import { registerSessionAutoRefresh } from './sessionAutoRefresh';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !anonKey) {
  throw new Error('Please provide valid keys in the env');
}

export const supabase = createSupabaseClient({
  url,
  anonKey,
  storage: encryptedStorage,
  detectSessionInUrl: Platform.OS === 'web',
});

registerSessionAutoRefresh(supabase);
