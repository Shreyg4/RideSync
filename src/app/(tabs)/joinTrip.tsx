import TextBox from '@/src/components/TextBox';
import LargeButton from '@/src/components/LargeButton';
import Screen from '@/src/components/Screen';
import { useState } from 'react';
import { router } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

export default function JoinTripScreen() {
  const [joinCode, setJoinCode] = useState('');
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <Screen bottomOffset={tabBarHeight}>
      <TextBox
        value={joinCode}
        onChangeText={setJoinCode}
        placeholder="Enter code"
        keyboardType="number-pad"
        testID="join-code-input"
      />
      <LargeButton label="Join Trip" onPress={() => router.back()} testID="join-trip-button" />
    </Screen>
  );
}
