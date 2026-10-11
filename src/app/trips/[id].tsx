import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as Linking from 'expo-linking';
import React from 'react';
import { ImageBackground, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tripImageSource } from '@/src/constants/tripImage';
import { colors, spacing, fontSize, fontWeight, radii } from '@/src/constants/theme';
import SmallButton from '@/src/components/SmallButton';
import { ChevronLeft, Dot, Pencil, Share2 } from 'lucide-react-native';
import LargeButton from '@/src/components/LargeButton';
import LoadingState from '@/src/components/LoadingState';
import EmptyState from '@/src/components/EmptyState';
import { useAsync } from '@/src/hooks/useAsync';
import { getTrip } from '@/src/services/tripService';
import { toTrip } from '@/src/lib/tripMapper';
import { reportError } from '@/src/lib/logger';
import { tripStatusLabel, tripTypeLabel, type TripStatus } from '@/src/domain/rules';

const TripDetailsScreen = () => {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const tripId = Number(Array.isArray(id) ? id[0] : id);

  const {
    data: row,
    loading,
    error,
  } = useAsync(
    () => (Number.isInteger(tripId) ? getTrip(tripId) : Promise.resolve(null)),
    [tripId],
    'TripDetailsScreen.getTrip'
  );

  const backButton = (
    <SmallButton
      icon={ChevronLeft}
      onPress={() => router.back()}
      accessibilityLabel="Go back"
      style={{ position: 'absolute', left: 15, top: insets.top, zIndex: 10 }}
    />
  );

  if (loading || !row) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        {loading ? (
          <LoadingState testID="trip-details-loading" />
        ) : (
          <EmptyState
            title={error ? "Couldn't load trip" : 'Trip not found'}
            subtitle={error ?? undefined}
          />
        )}
        {backButton}
      </View>
    );
  }

  const trip = toTrip(row);
  const inviteUrl = Linking.createURL(`invite/${row.invite_link}`);

  const shareInvite = () => {
    Share.share({ message: `Join my trip "${trip.name}" on RideSync: ${inviteUrl}` }).catch(
      (shareError) => reportError(shareError, { scope: 'TripDetailsScreen.shareInvite' })
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />

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
            pointerEvents="none"
            colors={['transparent', 'transparent', 'rgba(0, 0, 0, 1)']}
            locations={[0, 0.7, 0.85]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.title}>{trip.name}</Text>
        </ImageBackground>

        {/* Date, Time, Type are listed here */}
        <View style={styles.subContainer}>
          <Text style={styles.subHeading}>Date & Time</Text>
          <Text style={styles.text}>
            {trip.departureDate} <Dot {...iconProps} /> {trip.departureTime}
          </Text>
          <Text style={[styles.subHeading, { marginTop: 10 }]}>Type</Text>
          <Text style={styles.text}>{tripTypeLabel(trip.tripType)}</Text>
          <Text style={[styles.subHeading, { marginTop: 10 }]}>Status</Text>
          <Text style={styles.text}>{tripStatusLabel(row.trip_status as TripStatus)}</Text>
        </View>

        {/* Shows who is a part of the trip, and how to invite more */}
        <View style={styles.subContainer}>
          <Text style={styles.subHeading}>Members</Text>
          <Text style={[styles.text, { paddingBottom: spacing.lg }]}>
            {trip.numMembers} {trip.numMembers === 1 ? 'person is' : 'people are'} on this trip
          </Text>
          <LargeButton
            icon={Share2}
            label="Invite friends"
            variant="dashed"
            onPress={shareInvite}
          />
        </View>

        {/* Where itinerary will be listed */}
        <View style={styles.subContainer}>
          <Text style={styles.subHeading}>Itinerary</Text>
          <Text style={[styles.text, { paddingBottom: spacing.lg }]}>Not planned</Text>
          <LargeButton
            icon={Pencil}
            label="Edit itinerary"
            variant="dashed"
            onPress={() => router.push('/planner')}
          />
        </View>
        {/* The Directions Button */}
        <LargeButton label="Directions" onPress={() => router.back()} />
        {/* The start trip Button */}
        <LargeButton label="Start Trip" disabled onPress={() => router.back()} />
      </ScrollView>

      {/* Fixed top gradient so that status bar is always easy to see */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0, 0, 0, 1)', 'transparent']}
        locations={[0, 0.15]}
        style={StyleSheet.absoluteFill}
      />
      {backButton}
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
    color: colors.text,
    fontSize: fontSize.screenTitle,
    fontWeight: fontWeight.heavy,
    marginTop: 210,
    textAlign: 'center',
  },
  subContainer: {
    margin: 10,
    padding: 20,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
  },
  subHeading: {
    color: colors.text,
    fontSize: fontSize.sheetTitle,
    fontWeight: fontWeight.heavy,
    marginBottom: 10,
  },
  text: {
    color: colors.tintSubtle,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
  },
});

const iconProps = {
  color: colors.tintSubtle,
  size: 15,
};
