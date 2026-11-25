import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import TripList from '@/src/components/TripList';
import { useAsync } from '@/src/hooks/useAsync';
import { listTrips, subscribeToMembersOfTrips } from '@/src/services/tripService';
import { toTrip } from '@/src/lib/tripMapper';
import TripListItem from '@/src/components/TripListItem';

const loadTrips = async () => (await listTrips()).map(toTrip);

// A cancelled trip removes every member at once, and Realtime sends one event per row, so a burst
// of changes reloads the list once
const MEMBER_CHANGES_SETTLE_MS = 300;

export default function TripsScreen() {
  const { data, loading, error, reload } = useAsync(loadTrips, [], 'TripsScreen.listTrips');

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
    }, [reload])
  );

  // Keeps each trip's member count live while the list is open. A string key so the channel only
  // reopens when the set of trips changes, not on every reload
  const tripIdsKey = useMemo(() => (data ?? []).map((trip) => trip.id).join(','), [data]);
  useEffect(() => {
    const tripIds = tripIdsKey ? tripIdsKey.split(',').map(Number) : [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToMembersOfTrips(tripIds, () => {
      clearTimeout(timer);
      timer = setTimeout(reload, MEMBER_CHANGES_SETTLE_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [tripIdsKey, reload]);

  return (
    <TripList
      data={data ?? []}
      renderItem={(trip) => <TripListItem trip={trip} />}
      loading={loading && !data}
      emptyTitle={error ? "Couldn't load trips" : 'No upcoming trips'}
      emptySubtitle={error ?? 'Press the + button to create a trip or join one'}
      testID="trips-list"
    />
  );
}
