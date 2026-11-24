/**
 * @file map.tsx
 * @description A saved trip's stops and route on a full-screen map, opened by tapping the map on
 * its itinerary. Read-only: the pins can't be tapped
 */
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import FullTripMap from '@/src/components/FullTripMap';
import { useAsync } from '@/src/hooks/useAsync';
import { useTripRoute } from '@/src/hooks/useTripRoute';
import { toSavedTrip } from '@/src/lib/tripMapper';
import { getSavedTrip } from '@/src/services/tripService';

const SavedTripMapScreen = () => {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const savedTripId = Number(Array.isArray(id) ? id[0] : id);

  const { data, loading, error } = useAsync(
    async () => {
      if (!Number.isInteger(savedTripId)) return null;
      const row = await getSavedTrip(savedTripId);
      return row ? toSavedTrip(row) : null;
    },
    [savedTripId],
    'SavedTripMapScreen.load'
  );

  // Not a live trip, so the route is fetched without being saved to one
  const { route } = useTripRoute(null, data?.stops, data?.tripType);

  return (
    <FullTripMap
      stops={data?.stops}
      tripType={data?.tripType}
      route={route}
      loading={loading}
      error={data === null && !loading ? (error ?? 'Trip not found') : error}
      testID="saved-trip-map"
    />
  );
};

export default SavedTripMapScreen;
