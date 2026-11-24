/**
 * @file map.tsx
 * @description A trip's stops on a full-screen map, opened by tapping the planner's map. Pins open
 * their stop, and the map follows stop changes made on other phones
 */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import FullTripMap from '@/src/components/FullTripMap';
import { useAsync } from '@/src/hooks/useAsync';
import { useTripRoute } from '@/src/hooks/useTripRoute';
import { useTripStopsRealtime } from '@/src/hooks/useTripStopsRealtime';
import { toTrip, toTripStop } from '@/src/lib/tripMapper';
import { getTrip } from '@/src/services/tripService';
import { listTripStops } from '@/src/services/tripStopService';
import type { TripStop } from '@/src/types/trip';

const TripMapScreen = () => {
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

  useTripStopsRealtime(tripId, reload);
  const { route } = useTripRoute(tripId, data?.stops, data?.tripType);

  // Editors can change or remove the stop there, and everyone else sees its details
  const openStop = (stop: TripStop) =>
    router.push({
      pathname: '/trips/[id]/stopDetails',
      params: { id: tripId, stopId: stop.id },
    });

  return (
    <FullTripMap
      stops={data?.stops}
      tripType={data?.tripType}
      route={route}
      loading={loading}
      error={error}
      onOpenStop={openStop}
    />
  );
};

export default TripMapScreen;
