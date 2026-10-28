import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import TripList from '@/src/components/TripList';
import { useAsync } from '@/src/hooks/useAsync';
import { listTrips } from '@/src/services/tripService';
import { toTrip } from '@/src/lib/tripMapper';
import TripListItem from '@/src/components/TripListItem';

const loadTrips = async () => (await listTrips()).map(toTrip);

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
