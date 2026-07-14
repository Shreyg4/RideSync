import { StyleSheet, Text, View } from 'react-native'
import SmallButton from '@/src/components/smallButton'
import { ChevronLeft } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Colors from '@/src/constants/Colors'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'

const tripSettings = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={{flex: 1}}>
      <LinearGradient
        colors={[Colors.theme.card, Colors.theme.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.3 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.headerRow, {marginTop: insets.top}]}>
        <Text style={styles.title}>Trip Settings</Text>
        <View style={styles.headerLeft}>
          <SmallButton icon={ChevronLeft} onPress={() => router.back()}/>
        </View>
      </View>
      <Text>tripSettings</Text>
    </View>
  )
}

export default tripSettings

const styles = StyleSheet.create({
  title: {
    color: Colors.theme.text,
    fontSize: 30,
    fontWeight: '600',
    alignSelf: 'center',
  },
  headerRow: {
    width: '100%',
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 15
  },
  headerLeft: {
    position: 'absolute',
    left: 16,
    top: 0, 
    bottom: 0,
    justifyContent: 'center',
  },
})