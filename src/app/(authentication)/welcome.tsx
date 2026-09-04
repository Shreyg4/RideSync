import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import React from 'react';
import { colors, spacing, fontSize, fontWeight } from '@/src/constants/theme'
import LargeButton from '@/src/components/LargeButton';
import Screen from '@/src/components/Screen';

export default function WelcomeScreen() {
  return (
    <Screen scroll={false} applyTopInset style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.text}>Welcome to{'\n'}Ride Sync</Text>
      </View>
      <LargeButton label="Login" onPress={() => router.push('/login')} testID="login-button" />
      <LargeButton
        label="Create Account"
        onPress={() => router.push('/signUp')}
        testID="create-account-button"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  titleBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  text: {
    color: colors.text,
    fontSize: fontSize.screenTitle,
    fontWeight: fontWeight.heavy,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
