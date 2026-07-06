import TextBox from '@/src/components/textbox';
import LargeButton from '@/src/components/largeButton';
import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';

export default function joinTrip() {
const [joinCode, setJoinCode] = useState('')

  return (
    <ScrollView showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag" 
        keyboardShouldPersistTaps="never">
      <View style={{flex: 1}}>
        <TextBox value={joinCode} onChangeText={setJoinCode} placeholder='Enter code' keyboardType='number-pad'/>
        <LargeButton label='Join Trip' disabled={false} onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}
