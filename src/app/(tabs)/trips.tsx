import TripList from '@/src/components/TripList';
import { copy } from '@/src/constants/copy';
import trips from '@/src/__fixtures__/trips';

export default function TripsScreen() {
  return (
    <TripList
      data={trips}
      emptyTitle={copy.trips.emptyTitle}
      emptySubtitle={copy.trips.emptySubtitle}
      testID="trips-list"
    />
  );
}
