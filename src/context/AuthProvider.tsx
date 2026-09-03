import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import * as authService from '@/src/services/authService';
import { logger, reportError } from '@/src/lib/logger';

// Single source of truth for auth state. Wraps the whole app in _layout.tsx so screens
// read the session from context instead of each calling Supabase themselves.
export interface AuthContextType {
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

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // RootLayoutNav waits on this before redirecting anywhere.
  const [loading, setLoading] = useState(true); // Starts true so the app doesn't flash the login screen while still reading the stored session off disk.

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const stored = await authService.getSession();
        setSession(stored);
        setUser(stored?.user ?? null);
      } catch (error) {
        reportError(error, { scope: 'AuthProvider.initializeSession' });
      } finally {
        setLoading(false);
      }
    };
    initializeSession();

    const unsubscribe = authService.onAuthStateChange((event, next) => {
      logger.info('auth state changed', { event, hasSession: !!next });
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
    });

    // Without this the listener keeps firing after unmount and leaks.
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signIn: authService.signIn,
        signUp: authService.signUp,
        signOut: authService.signOut,
      }}
    >
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
