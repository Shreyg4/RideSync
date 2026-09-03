import { View } from 'react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/src/components/ScreenHeader';
import React from 'react';

const EnterStopScreen = () => {
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Set Stop" onBack={() => router.back()} />
    </View>
  );
};

export default EnterStopScreen;
