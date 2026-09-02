import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from '@/src/types/database';

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

export type AppSupabaseClient = ReturnType<typeof createSupabaseClient>;
