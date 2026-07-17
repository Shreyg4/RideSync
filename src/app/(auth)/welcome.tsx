import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import React from 'react'
import Colors from '@/src/constants/Colors';
import LargeButton from '@/src/components/largeButton';

export default function welcome() {
  const inset = useSafeAreaInsets()

  return (
    <View style={[styles.container, { marginTop: inset.top, marginBottom: inset.bottom}]} onTouchStart={(e) => console.log('container touch', e.nativeEvent.pageY)}>
      <View style={{flex: 1, marginTop: 30}}>
        <Text style={styles.text}>Welcome to{'\n'}Ride Sync</Text>
      </View>
      <LargeButton label='Login' onPress={() => router.push('/login')}/>
      <LargeButton label='Create Account' onPress={() => router.push('/sign-up')}/>
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
    color: Colors.theme.text,
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
  }, 
})