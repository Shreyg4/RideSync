import { View, Text, StyleSheet, Pressable, Keyboard } from 'react-native'
import React from 'react'
import TextBox from '@components/textbox'
import { useState } from 'react'
import Colors from '../constants/Colors'
import { LinearGradient } from 'expo-linear-gradient'
import { ImagePlus, Route, Waypoints, MapPin, Repeat} from 'lucide-react-native'
import * as Haptics from 'expo-haptics';
import LargeButton from '../components/largeButton'
import { router } from 'expo-router'

const tripType = [{label: 'Single-day', icon: Route}, {label: 'Multi-day', icon: Waypoints}]
const tripForm = [{label: 'One-way', icon: MapPin}, {label: 'Round-trip', icon: Repeat}]

const createTripScreen = () => {
  const [tripName, setTripName] = useState('')
  const [tripDate, setTripDate] = useState('')
  const [tripTime, setTripTime] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState<string | null>(null)

  return (
    <Pressable onPress={() => {Keyboard.dismiss()}} style={styles.container}>
      <View>
        <LinearGradient
          colors={[Colors.theme.card, Colors.theme.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.3 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.title}>Create Trip</Text>
        <TextBox value={tripName} onChangeText={setTripName} placeholder='Enter trip name' />
        <TextBox value={tripDate} onChangeText={setTripDate} placeholder='Enter date' />
        <TextBox value={tripTime} onChangeText={setTripTime} placeholder='Enter time' />
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
        
        {/* Select which type of trip this will be */}
        <View style={styles.types}>
          {tripType.map((tripType) => {
            const Icon = tripType.icon
            return(
              <Pressable key={tripType.label} onPress={() => {
                setSelectedType(tripType.label)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={() => [
                {
                  backgroundColor: selectedType === tripType.label ? Colors.theme.tint : 'transparent',
                  width: 185,
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
              style={() => [
                {
                  backgroundColor: selectedForm === tripForm.label ? Colors.theme.tint : 'transparent',
                  width: 185,
                  height: 70,
                  borderRadius: 20,
                  justifyContent: 'center',
                  alignItems: 'center'
                }
              ]}>        
                <Icon color={Colors.theme.text} size={24} style={{alignSelf: 'center'}}/>    
                <Text style={styles.typeText}>{tripForm.label}</Text>
              </Pressable>
            )
          })}
        </View>
        
        <LargeButton 
          label='Create Trip' disabled={false}
          onPress={() => router.back()}
          style={{marginTop: 30}}
        />

      </View>
    </Pressable>
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
    margin: 30,
  },
  imageBox: {
    backgroundColor: Colors.theme.card,
    borderColor: Colors.theme.textMutedLight,
    height: 100,
    borderWidth: 1,
    borderRadius: 20,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10
  },
  types: {
    backgroundColor: Colors.theme.card,
    height: 70,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 20,
    marginHorizontal: 10
  },
  type: {
    
  },
  typeText: {
    color: Colors.theme.text,
    fontSize: 10,
    alignSelf: 'center'
  }
})
export default createTripScreen