import TextBox from '@/src/components/TextBox';
import { copy } from '@/src/constants/copy';
import LargeButton from '@/src/components/LargeButton';
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { router } from 'expo-router';

export default function JoinTripScreen() {
  const [joinCode, setJoinCode] = useState('');

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="never"
    >
      <View style={{ flex: 1 }}>
        <TextBox
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder={copy.fields.joinCode}
          keyboardType="number-pad"
        />
        <LargeButton label="Join Trip" disabled={false} onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}
