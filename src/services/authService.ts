import { supabase } from '@/src/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export type AuthEvent = Parameters<Parameters<typeof supabase.auth.onAuthStateChange>[0]>[0];

export const getSession = async (): Promise<Session | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const onAuthStateChange = (handler: (event: AuthEvent, session: Session | null) => void) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(handler);
  return () => subscription.unsubscribe();
};

export const signUp = async (
  first_name: string,
  last_name: string,
  username: string,
  email: string,
  password: string
): Promise<User | null> => {
  const { data, error } = await supabase.auth.signUp({
    options: { data: { first_name, last_name, username } },
    email,
    password,
  });
  if (error) throw error;
  return data.user;
};

export const signIn = async (email: string, password: string): Promise<void> => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
};

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
};
