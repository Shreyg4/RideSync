import TripList from '@/src/components/TripList';
import trips from '@/src/__fixtures__/trips';

export default function TripsScreen() {
  return (
    <TripList
      data={trips}
      emptyTitle="No upcoming trips"
      emptySubtitle="Press the + button to create a trip or join one"
      testID="trips-list"
    />
  );
}
