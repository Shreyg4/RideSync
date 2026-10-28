import TripList from '@/src/components/TripList';
import { listSavedTrips } from '@/src/services/tripService';
import { toSavedTrip } from '@/src/lib/tripMapper';
import { useAsync } from '@/src/hooks/useAsync';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import SavedTripListItem from '@/src/components/SavedTripListItem';

const loadSavedTrips = async () => (await listSavedTrips()).map(toSavedTrip);

export default function SavedTripsScreen() {
  const { data, loading, error, reload } = useAsync(
    loadSavedTrips,
    [],
    'SavedTripsScreen.listSavedTrips'
  );

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
      renderItem={(trip) => <SavedTripListItem savedTrip={trip} />}
      loading={loading && !data}
      emptyTitle={error ? "Couldn't load trips" : 'No saved trips'}
      emptySubtitle={error ?? 'Trips you save are kept here to reuse later'}
      testID="saved-trips-list"
    />
  );
}
