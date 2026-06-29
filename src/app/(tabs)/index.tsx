import { View } from '@/src/components/Themed';
import trips from '@assets/dummydata/data/trips';
import TripListItem from '@components/TripListItem';
import { FlatList } from 'react-native';

export default function TripsScreen() {
  return (
    <View>
      <FlatList 
        data={trips} 
        renderItem={({ item }) => <TripListItem trip={item}/> }
        contentContainerStyle={{ gap: 10, padding: 10 }}
      />
    </View>
  );
}