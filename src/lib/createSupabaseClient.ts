/**
 * @file createSupabaseClient.ts
 * @description A wrapper file around supabase-js's create client,
 * that creates the client with the app's authentication policy set up
 */
import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from '@/src/types/database';

// Storage contract pulled from supabase-js's own options - what encryptedStorage Implements
export type SessionStorage = NonNullable<
  NonNullable<SupabaseClientOptions<'public'>['auth']>['storage']
>;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  storage: SessionStorage;
  detectSessionInUrl: boolean;
}

export const createSupabaseClient = ({
  url,
  anonKey,
  storage,
  detectSessionInUrl,
}: SupabaseConfig) =>
  createClient<Database>(url, anonKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl,
      flowType: 'pkce',
    },
  });

// The configured client type - what sessionAutoRefresh consumes
export type AppSupabaseClient = ReturnType<typeof createSupabaseClient>;
