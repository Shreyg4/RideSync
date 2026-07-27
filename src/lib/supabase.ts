import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLIABLE_KEY;

if(!supabaseUrl || !supabaseAnonKey){
  throw new Error("Please provide valid keys in the env")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
})