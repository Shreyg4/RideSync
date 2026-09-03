import trips from '@/src/__fixtures__/trips';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import React from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tripImageSource } from '@/src/constants/tripImage';
import Colors from '@/src/constants/colors';
import { radii } from '@/src/constants/radii';
import { fontSize, fontWeight } from '@/src/constants/typography';
import SmallButton from '@/src/components/SmallButton';
import { ChevronLeft, Dot, Pencil } from 'lucide-react-native';
import LargeButton from '@/src/components/LargeButton';

const TripDetailsScreen = () => {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const tripId = Array.isArray(id) ? id[0] : id;
  const trip = trips.find((t) => t.id.toString() === tripId);

  if (!trip) {
    return <Text>Trip not Found</Text>;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        <ImageBackground
          source={tripImageSource(trip.image)}
          style={[styles.image, { paddingTop: insets.top }]}
        >
          {/* Bottom scrim: keeps the title readable; scrolls away with the image */}
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(0, 0, 0, 1)']}
            locations={[0, 0.7, 0.85]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.title}>{trip?.name}</Text>
        </ImageBackground>

        {/* Date, Time, Type, Form are listed here */}
        <View style={styles.subContainer}>
          <Text style={styles.subHeading}>Date & Time</Text>
          <Text style={styles.text}>
            {trip.departureDate} <Dot {...iconProps} /> {trip.departureTime}{' '}
          </Text>
          <Text style={[styles.subHeading, { marginTop: 10 }]}>Type</Text>
          <Text style={styles.text}>
            {trip.duration} <Dot {...iconProps} /> {trip.tripType}{' '}
          </Text>
        </View>

        {/* Shows who is a part of the trip */}
        <View style={styles.subContainer}>
          <Text style={styles.subHeading}>Members</Text>
          <Text style={styles.text}>There are {trip?.numMembers} on this trip</Text>
        </View>

        {/* Where itinerary will be listed */}
        <View style={styles.subContainer}>
          <Text style={styles.subHeading}>Itinerary</Text>
          <Text style={[styles.text, { paddingBottom: 300 }]}>Not planned</Text>
          <LargeButton
            icon={Pencil}
            label="Edit itinerary"
            color={Colors.textMutedLight}
            onPress={() => router.push('/planner')}
            backgroundColor={Colors.card}
            backgroundColorPressed={Colors.textMuted}
            style={{
              borderWidth: 1,
              borderColor: Colors.textMutedLight,
              borderStyle: 'dashed',
            }}
          />
        </View>
        {/* The Directions Button */}
        <LargeButton label="Directions" onPress={() => router.back()} style={{ margin: 10 }} />
        {/* The start trip Button */}
        <LargeButton
          label="Start Trip"
          disabled={true}
          onPress={() => router.back()}
          style={{ margin: 10 }}
        />
      </ScrollView>

      {/* Fixed top gradient so that status bar is always easy to see */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0, 0, 0, 1)', 'transparent']}
        locations={[0, 0.15]}
        style={StyleSheet.absoluteFill}
      />
      <SmallButton
        icon={ChevronLeft}
        onPress={() => router.back()}
        style={{ position: 'absolute', left: 15, top: insets.top, zIndex: 10 }}
      />
    </View>
  );
};

export default TripDetailsScreen;

const styles = StyleSheet.create({
  image: {
    width: '100%',
    aspectRatio: 1.2,
  },
  title: {
    color: Colors.text,
    fontSize: fontSize.screenTitle,
    fontWeight: fontWeight.heavy,
    marginTop: 210,
    textAlign: 'center',
  },
  subContainer: {
    margin: 10,
    padding: 20,
    borderRadius: radii.xl,
    backgroundColor: Colors.card,
  },
  subHeading: {
    color: Colors.text,
    fontSize: fontSize.sheetTitle,
    fontWeight: fontWeight.heavy,
    marginBottom: 10,
  },
  text: {
    color: Colors.tintSubtle,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
  },
});

const iconProps = {
  color: Colors.tintSubtle,
  size: 15,
};
