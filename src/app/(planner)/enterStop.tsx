import { StyleSheet, Text, View } from 'react-native'
import { ChevronLeft, Settings } from 'lucide-react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import SmallButton from '@/src/components/smallButton'
import LargeButton from '@/src/components/largeButton'
import React from 'react'
import Colors from '@/src/constants/Colors'

const enterStop = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={{flex: 1}}>
      <View style={[styles.headerRow, {marginTop: insets.top}]}>
          <Text style={styles.title}>Set Stop</Text>
          <View style={styles.headerLeft}>
            <SmallButton icon={ChevronLeft} onPress={() => router.back()}/>
          </View>
        </View>
    </View>
  )
}

export default enterStop

const styles = StyleSheet.create({
    header: {
      position: 'absolute',
      height: 15,
      left: 0,
      right: 0,
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    title: {
      color: Colors.theme.text,
      fontSize: 25,
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
    headerRight: {
      position: 'absolute',
      right: 16,
      top: 0, 
      bottom: 0,
      justifyContent: 'center',
    },
})