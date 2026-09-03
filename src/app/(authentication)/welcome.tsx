import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import React from 'react';
import Colors from '@/src/constants/colors';
import { fontSize, fontWeight } from '@/src/constants/typography';
import LargeButton from '@/src/components/LargeButton';

export default function WelcomeScreen() {
  const inset = useSafeAreaInsets();

  return (
    <View style={[styles.container, { marginTop: inset.top, marginBottom: inset.bottom }]}>
      <View style={{ flex: 1, marginTop: 30 }}>
        <Text style={styles.text}>Welcome to{'\n'}Ride Sync</Text>
      </View>
      <LargeButton label="Login" onPress={() => router.push('/login')} />
      <LargeButton label="Create Account" onPress={() => router.push('/signUp')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflow: 'hidden',
  },
  text: {
    color: Colors.text,
    fontSize: fontSize.screenTitle,
    fontWeight: fontWeight.heavy,
    textAlign: 'center',
  },
});
