/**
 * @file map.tsx
 * @description A trip's stops on a full-screen map, opened by tapping the planner's map. Pins open
 * their stop, and the map follows stop changes made on other phones
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmptyState from '@/src/components/EmptyState';
import LoadingState from '@/src/components/LoadingState';
import SmallButton from '@/src/components/SmallButton';
import StopsMap from '@/src/components/StopsMap';
import { colors, spacing } from '@/src/constants/theme';
import { useAsync } from '@/src/hooks/useAsync';
import { useTripRoute } from '@/src/hooks/useTripRoute';
import { useTripStopsRealtime } from '@/src/hooks/useTripStopsRealtime';
import { toTrip, toTripStop } from '@/src/lib/tripMapper';
import { getTrip } from '@/src/services/tripService';
import { listTripStops } from '@/src/services/tripStopService';
import type { TripStop } from '@/src/types/trip';

const BACK_BUTTON_SIZE = 48;
// More room around the stops than a small map gets, since the route can bulge out past them and a
// full screen has space to show where the trip sits
const FIT_MARGIN = 80;

const TripMapScreen = () => {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const tripId = Number(Array.isArray(id) ? id[0] : id);

  // The trip type says whether the route drives back to the start
  const { data, loading, error, reload } = useAsync(
    async () => {
      if (!Number.isInteger(tripId)) return { stops: [], tripType: undefined };
      const [trip, stops] = await Promise.all([getTrip(tripId), listTripStops(tripId)]);
      return { stops: stops.map(toTripStop), tripType: trip ? toTrip(trip).tripType : undefined };
    },
    [tripId],
    'TripMapScreen.load'
  );
  const stops = data?.stops;

  useTripStopsRealtime(tripId, reload);
  const { route } = useTripRoute(tripId, stops, data?.tripType);

  // Keeps the stops clear of the notch or Dynamic Island and the back button at the top, and the
  // home indicator at the bottom, all of which the full-screen map runs under
  const coveredEdges = {
    top: insets.top + spacing.sm + BACK_BUTTON_SIZE,
    right: insets.right,
    bottom: insets.bottom,
    left: insets.left,
  };

  // Editors can change or remove the stop there, and everyone else sees its details
  const openStop = (stop: TripStop) =>
    router.push({
      pathname: '/trips/[id]/stopDetails',
      params: { id: tripId, stopId: stop.id },
    });

  return (
    <View style={styles.screen}>
      {/* The map fills the screen, so a swipe from its edge has to pan the map, not leave */}
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      {/* Keeps showing the pins during a reload instead of flashing the spinner */}
      {stops ? (
        <StopsMap
          stops={stops}
          route={route}
          onOpenStop={openStop}
          coveredEdges={coveredEdges}
          fitMargin={FIT_MARGIN}
          testID="trip-map"
        />
      ) : loading ? (
        <LoadingState testID="trip-map-loading" />
      ) : (
        <EmptyState title="Couldn't load the map" subtitle={error ?? undefined} />
      )}

      <SmallButton
        icon={ChevronLeft}
        onPress={() => router.back()}
        accessibilityLabel="Go back"
        color={colors.text}
        backgroundColor="rgba(0, 0, 0, 0.6)"
        diameter={BACK_BUTTON_SIZE}
        style={[styles.back, { top: insets.top + spacing.sm }]}
      />
    </View>
  );
};

export default TripMapScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  back: {
    position: 'absolute',
    left: spacing.md,
  },
});
