import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/src/components/ScreenHeader';
import { gradients } from '@/src/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';

const TripSettingsScreen = () => {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        pointerEvents="none"
        {...gradients.cardToBackground}
        style={StyleSheet.absoluteFill}
      />
      <ScreenHeader title="Trip Settings" onBack={() => router.back()} />
    </View>
  );
};

export default TripSettingsScreen;
