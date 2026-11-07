import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import ScreenHeader from '@/src/components/ScreenHeader';
import TripMap from '@/src/components/TripMap';
import React from 'react';

const EnterStopScreen = () => {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Set Stop" onBack={() => router.back()} />
      <TripMap testID="add-stop-map" />
    </View>
  );
};

export default EnterStopScreen;
