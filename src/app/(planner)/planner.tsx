import { StyleSheet, Text, View, ScrollView } from 'react-native'
import { useState } from 'react'
import { ChevronLeft, Settings } from 'lucide-react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import SmallButton from '@/src/components/smallButton'
import LargeButton from '@/src/components/largeButton'
import TextBox from '@/src/components/textbox'
import React from 'react'
import Colors from '@/src/constants/Colors'
import { LinearGradient } from 'expo-linear-gradient'

const planner = () => {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0)
  const [tripDate, setTripDate] = useState('')
  const [tripTime, setTripTime] = useState('')
  return (
    <View style={{flex: 1}}>
      <View>
        <LinearGradient
          colors={[Colors.theme.card, Colors.theme.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.7 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.headerRow, {marginTop: insets.top}]} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <Text style={styles.title}>Planner</Text>
          <View style={styles.headerLeft}>
            <SmallButton icon={ChevronLeft} onPress={() => router.back()}/>
          </View>
          <View style={styles.headerRight}>
            <SmallButton icon={Settings} onPress={() => router.push('/tripSettings')}/>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ paddingBottom: insets.bottom + 10}} 
            keyboardDismissMode="on-drag" 
            keyboardShouldPersistTaps="never">
        <View style={styles.plannerStyle}>
          <TextBox value={tripDate} onChangeText={setTripDate} placeholder='Start date'/>
          <TextBox value={tripTime} onChangeText={setTripTime} placeholder='Start time' style={{marginTop: 300}}/>
          <TextBox value={tripTime} onChangeText={setTripTime} placeholder='Start time' style={{marginTop: 300}}/>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.subtext}>Trip Distance</Text>
          <Text style={styles.subtext}>Total Time</Text>
        </View>
        <LargeButton 
          label='Save Trip' disabled={false}
          onPress={() => router.replace('/journeys')} 
        />
      </ScrollView>

      <LinearGradient colors={[Colors.theme.background, 'transparent']}
        style={[styles.header, {top: insets.top + headerHeight}]}
      />
    </View>
  )
}

export default planner

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
  text: {
    color: Colors.theme.text,
    alignSelf: 'center',
    marginTop: 90
  },
  subtext: {
    color: Colors.theme.text,
    justifyContent: 'flex-start',
    alignSelf: 'center',
  },
  plannerStyle: {
    flexGrow: 1,
    backgroundColor: Colors.theme.card,
    margin: 10,
    borderRadius: 20
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    margin: 15,
    columnGap: 100
  },  
})