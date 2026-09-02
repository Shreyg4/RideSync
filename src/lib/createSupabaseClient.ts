import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';

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
  createClient(url, anonKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl,
      flowType: 'pkce',
    },
  });

export type AppSupabaseClient = ReturnType<typeof createSupabaseClient>;
