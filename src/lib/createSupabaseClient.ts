import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";

type SessionStorage = NonNullable<NonNullable<SupabaseClientOptions<'public'>['auth']>['storage']>;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  storage: SessionStorage;
}

export const createSupabaseClient = ({ url, anonKey, storage }: SupabaseConfig) => 
  createClient(url, anonKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
});

export type AppSupabaseClient = ReturnType<typeof createSupabaseClient>;