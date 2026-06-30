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
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';


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
        title: '',
        headerShown: true,
        headerShadowVisible: false,
        headerTintColor: Colors.theme.tint,
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: Colors.theme.background },
        headerLeft: () => (
          <SmallButton
            icon={ChevronLeft}
            onPress={() => router.back()}
            size={32}
            style={{  }}
          />
        )
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
        
        <View>
          <Text style={{ marginTop: 700, color: 'white' }}>Trip details for id: {id}</Text>
        </View>
      </ScrollView>

      {/* Fixed top scrim: stays put while content scrolls, so the status bar /
          back button remain readable even after the image scrolls away. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 20 }}
        pointerEvents="none"
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
    marginLeft: 10

  }
})