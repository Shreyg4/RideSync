import TripList from '@/src/components/TripList';
import savedTrips from '@/src/__fixtures__/savedTrips';

export default function SavedTripsScreen() {
  return (
    <TripList
      data={savedTrips}
      emptyTitle="No saved trips"
      emptySubtitle="Trips you save are kept here to reuse later"
      testID="saved-trips-list"
    />
  );
}
