/**
 * @file index.tsx
 * @description The entrance to the app which looks at auth state and decides where to send the user
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/context/AuthProvider';
import LoadingState from '@/src/components/LoadingState';

export default function IndexScreen() {
  const { loading, session } = useAuth();

  if (loading) return <LoadingState testID="session-loading" />;

  return <Redirect href={session ? '/trips' : '/welcome'} />;
}
