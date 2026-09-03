import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/context/AuthProvider';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import Colors from '@/src/constants/colors';

export default function IndexScreen() {
  const { loading, session } = useAuth();

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size={'large'} color={Colors.theme.tint} />
      </View>
    );
  return <Redirect href={session ? '/trips' : '/welcome'} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.theme.background,
  },
});
