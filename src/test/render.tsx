import { AuthContext, type AuthContextType } from '@/src/context/AuthProvider';
import { render } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

const metrics: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

export const anonymousAuth: AuthContextType = {
  session: null,
  user: null,
  loading: false,
  signUp: async () => null,
  signIn: async () => {},
  signOut: async () => {},
};

export const signedInAuth = (overrides: Partial<AuthContextType> = {}): AuthContextType => ({
  ...anonymousAuth,
  session: { access_token: 'x' } as AuthContextType['session'],
  user: { id: 'user-1' } as AuthContextType['user'],
  ...overrides,
});

export const renderScreen = (ui: React.ReactElement, auth: AuthContextType = anonymousAuth) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>
    </SafeAreaProvider>
  );
