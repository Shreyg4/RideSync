import TripList from '@/src/components/TripList';
import { copy } from '@/src/constants/copy';
import savedTrips from '@/src/__fixtures__/savedTrips';

export default function SavedTripsScreen() {
  return (
    <TripList
      data={savedTrips}
      emptyTitle={copy.savedTrips.emptyTitle}
      emptySubtitle={copy.savedTrips.emptySubtitle}
      testID="saved-trips-list"
    />
  );
}
