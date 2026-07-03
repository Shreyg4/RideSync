import { View, Text, StyleSheet, Pressable, Keyboard, Platform, ScrollView} from 'react-native'
import React from 'react'
import TextBox from '@components/textbox'
import { useState } from 'react'
import Colors from '../constants/Colors'
import { LinearGradient } from 'expo-linear-gradient'
import { ImagePlus, Route, Waypoints, MapPin, Repeat, ChevronLeft} from 'lucide-react-native'
import * as Haptics from 'expo-haptics';
import LargeButton from '../components/largeButton'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import SmallButton from '../components/smallButton'

const tripType = [{label: 'Single-day', icon: Route}, {label: 'Multi-day', icon: Waypoints}]
const tripForm = [{label: 'One-way', icon: MapPin}, {label: 'Round-trip', icon: Repeat}]

const createTripScreen = () => {
  const insets = useSafeAreaInsets();

  const [tripName, setTripName] = useState('')
  const [tripDate, setTripDate] = useState('')
  const [tripTime, setTripTime] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState<string | null>(null)

  return (
    <View style={{ paddingTop: Platform.select ({ ios: 0, android: insets.top }) }}>
      <LinearGradient
        colors={[Colors.theme.card, Colors.theme.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.3 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: insets.bottom + 20}} 
          keyboardDismissMode="on-drag" 
          keyboardShouldPersistTaps="never">
        <View style={[styles.headerRow]}>
          <Text style={styles.title}>Create Trip</Text>
          {Platform.OS === 'android' && (
            <View style={styles.headerLeft}>
              <SmallButton icon={ChevronLeft} onPress={() => router.dismiss()} style={{left: 10}}/>
            </View>
          )}
        </View>

        <TextBox value={tripName} onChangeText={setTripName} placeholder='Enter trip name' style={{marginTop: 0}} />

        {/* Select which type of trip this will be */}
        <View style={[styles.types, {marginBottom: 20}]}>
          {tripType.map((tripType) => {
            const Icon = tripType.icon
            return(
              <Pressable key={tripType.label} onPress={() => {
                setSelectedType(tripType.label)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              //Styling of selected pill
              style={() => [
                {
                  backgroundColor: selectedType === tripType.label ? Colors.theme.tint : 'transparent',
                  width: '50%',
                  height: 70,
                  borderRadius: 20,
                  justifyContent: 'center',
                  alignItems: 'center'
                }
              ]}>        
                <Icon color={Colors.theme.text} size={24} style={{alignSelf: 'center'}}/>    
                <Text style={styles.typeText}>{tripType.label}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* Select which form of trip this will be */}
        <View style={styles.types}>
          {tripForm.map((tripForm) => {
            const Icon = tripForm.icon
            return(
              <Pressable key={tripForm.label} onPress={() => {
                setSelectedForm(tripForm.label)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              //Styling of selected pill
              style={() => [
                {
                  backgroundColor: selectedForm === tripForm.label ? Colors.theme.tint : 'transparent',
                  width: '50%',
                  height: 70,
                  borderRadius: 20,
                  justifyContent: 'center',
                  alignItems: 'center',
                }
              ]}>        
                <Icon color={Colors.theme.text} size={24} style={{alignSelf: 'center'}}/>    
                <Text style={styles.typeText}>{tripForm.label}</Text>
              </Pressable>
            )
          })}
        </View>
        
        <TextBox value={tripDate} onChangeText={setTripDate} placeholder='Start date' style={{marginBottom: 0}} />
        <TextBox value={tripTime} onChangeText={setTripTime} placeholder='Start time' />
        {/* Button for user to include an image */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={({ pressed }) => [
            styles.imageBox,
            {
              transform: [{ scale: pressed ? 0.95 : 1 }],
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <ImagePlus color={Colors.theme.textMutedLight} style={{marginBottom: 10}}/>
          <Text style={{color: Colors.theme.textMutedLight}}>Add cover image (optional)</Text>
        </Pressable>
        <LargeButton 
          label='Create Trip' disabled={false}
          onPress={() => router.back()}
          style={{marginTop: 30}}
        />
      </ScrollView>

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    color: Colors.theme.text,
    fontSize: 30,
    fontWeight: '600',
    alignSelf: 'center',

  },
  imageBox: {
    backgroundColor: Colors.theme.card,
    borderColor: Colors.theme.textMutedLight,
    width: '95%',
    aspectRatio: 1.6,
    borderWidth: 1,
    borderRadius: 20,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  types: {
    backgroundColor: Colors.theme.card,
    width: '95%',
    height: 70,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  typeText: {
    color: Colors.theme.text,
    fontSize: 10,
    alignSelf: 'center'
  },
  headerRow: {
    width: '100%',
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 30
  },
  headerLeft: {
    position: 'absolute',
    left: 16,
    top: 0, 
    bottom: 0,
    justifyContent: 'center',
  },
})
export default createTripScreen