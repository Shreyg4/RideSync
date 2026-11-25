import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import React from 'react';
import { colors, spacing, fontSize, fontWeight } from '@/src/constants/theme';
import LargeButton from '@/src/components/LargeButton';
import Screen from '@/src/components/Screen';

const logo = require('@assets/images/ridesync-logo.png');

export default function WelcomeScreen() {
  return (
    <Screen scroll={false} gradient applyTopInset style={styles.container}>
      <View style={styles.titleBlock}>
        <Image
          source={logo}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          testID="welcome-logo"
        />
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
    alignItems: 'center',
  },
  logo: {
    width: 160,
    height: 150,
  },
  text: {
    color: colors.text,
    fontSize: fontSize.screenTitle,
    fontWeight: fontWeight.heavy,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
