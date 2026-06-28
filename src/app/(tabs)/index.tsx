import { View } from '@/src/components/Themed';
import trips from '../../../dummydata/data/trips';
import TripListItem from '../../components/TripListItem';

export default function TripsScreen() {
  return (
    <View>
      <TripListItem trip={trips[0]}/>
      <TripListItem trip={trips[1]}/>
      <TripListItem trip={trips[2]}/>

    </View>
  );
}
