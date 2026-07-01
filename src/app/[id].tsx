import trips from '@assets/dummydata/data/trips';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { defaultTripImage } from '../components/TripListItem';
import Colors from '../constants/Colors';
import SmallButton from '../components/smallButton';
import { ChevronLeft, Dot, Pencil } from 'lucide-react-native';
import { router } from 'expo-router';
import LargeButton from '../components/largeButton';


const TripDetails = () => {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const trip = trips.find((p) => p.id.toString() === id)

  if (!trip) {
    return <Text>Trip not Found</Text>
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack.Screen options={{ 
        headerShown: false,
      }}/>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom }}>
        <ImageBackground source={{ uri: trip.image || defaultTripImage }} style={[styles.image, { paddingTop: insets.top }]}>
          {/* Bottom scrim: keeps the title readable; scrolls away with the image */}
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(0, 0, 0, 1)']} locations={[0, 0.7, 0.85]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.title}>{trip?.name}</Text>
        </ImageBackground>

        {/* Date, Time, Type, Form are listed here */}
        <View style={styles.subContainer}>
          <Text style={styles.subHeading}>Date & Time</Text>
          <Text style={styles.text}>{trip.departureDate} <Dot {...iconProps}/> {trip.departureTime} </Text>
          <Text style={[styles.subHeading, {marginTop: 10}]}>Type</Text>
          <Text style={styles.text}>{trip.type} <Dot {...iconProps}/> {trip.form} </Text>
        </View>
        
        {/* Shows who is a part of the trip */}
        <View style={styles.subContainer}>
          <Text style={styles.subHeading}>Members</Text>
          <Text style={styles.text}>There are {trip?.numMembers} on this trip</Text>
        </View>

        {/* Where itenerary will be listed */}
        <View style={styles.subContainer}>
          <Text style={styles.subHeading}>Itenerary</Text>
          <Text style={[styles.text, {paddingBottom: 300}]}>Not planned</Text>
          <LargeButton icon={Pencil} label="Edit itenery" color={Colors.theme.textMutedLight}
            onPress={() => router.back()}
            backgroundColor={Colors.theme.card}
            backgroundColorPressed={Colors.theme.textMuted}
            style={{
              width: 350,
              borderWidth: 1,
              borderColor: Colors.theme.textMutedLight,
              borderStyle: 'dashed'
            }}
          />
        </View>
        {/* The Directions Button */}
        <LargeButton label="Directions"
          onPress={() => router.back()}
          style={{margin: 10,}}
        />
        {/* The start trip Button */}
        <LargeButton label="Start Trip"
          disabled={true}
          onPress={() => router.back()}
          style={{margin: 10}}
        />
      </ScrollView>
      
      {/* Fixed top gradient so that status bar is always easy to see */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0, 0, 0, 1)', 'transparent']} locations={[0, 0.15]}
        style={StyleSheet.absoluteFill}
      />
      <SmallButton icon={ChevronLeft}
        onPress={() => router.back()}
        style={{ position: 'absolute', left: 10, top: insets.top - 10, zIndex: 10 }}
      />
    </View>
  )
}

export default TripDetails


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.theme.background,
  },
  image: {
    width: '100%',
    aspectRatio: 1.2,
  },
  title: {
    color: Colors.theme.text,
    fontSize: 40,
    fontWeight: '800',
    marginTop: 210,
    textAlign: 'center'
  },
  subContainer: {
    margin: 10,
    padding: 20,
    borderRadius: 25,
    backgroundColor: Colors.theme.card
  },
  subHeading: {
    color: Colors.theme.text,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 10
  },
  text: {
    color: Colors.theme.tintSubtle,
    fontSize: 15,
    fontWeight: '400'
  }
})

const iconProps = {
  color: Colors.theme.tintSubtle,
  size: 15,
};