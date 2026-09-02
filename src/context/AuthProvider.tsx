import { supabase } from '@/src/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';

// Single source of truth for auth state. Wraps the whole app in _layout.tsx so screens
// read the session from context instead of each calling Supabase themselves.
interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;

  // Resolves to the new user so the caller can act on its id (e.g. upload an avatar).
  // Null when email confirmation is on and the account isn't usable yet.
  signUp: (
    first_name: string,
    last_name: string,
    username: string,
    email: string,
    password: string
  ) => Promise<User | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // RootLayoutNav waits on this before redirecting anywhere.
  const [loading, setLoading] = useState(true); // Starts true so the app doesn't flash the login screen while still reading the stored session off disk.

  useEffect(() => {
    const InitializeSession = async () => {
      // Check for session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      // If session exists retreive it
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };
    InitializeSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });
    // Without this the listener keeps firing after unmount and leaks.
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // The profile fields ride along in `options.data`, which lands in auth.users.raw_user_meta_data.
  // The handle_new_user trigger reads them from there to build the profiles row
  const signUp = async (
    first_name: string,
    last_name: string,
    username: string,
    email: string,
    password: string
  ) => {
    const { data, error } = await supabase.auth.signUp({
      options: { data: { first_name, last_name, username } },
      email,
      password,
    });
    if (error) {
      throw error;
    }
    // With email confirmations off this also stores a session, so the caller's next
    // Supabase call is already authenticated and auth.uid() is populated for RLS.
    return data.user;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
