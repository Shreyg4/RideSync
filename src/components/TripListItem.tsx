import { Text, View } from '@/src/components/Themed';
import { Image, StyleSheet } from 'react-native';
import { Trip } from '../../dummydata/types';
import Colors from '../constants/Colors';

export const defaultTripImage = 'https://imageio.forbes.com/specials-images/imageserve//62bdd4a21a6dc599d18bca9b/0x0.jpg?format=jpg&height=900&width=1600&fit=bounds';

type TripListItemProps = {
    trip: Trip;
}

const TripListItem = ({ trip }: TripListItemProps) => {
  return (
    <View style={styles.container}>
      <Image source={{uri: trip.image || defaultTripImage}} style={styles.image} />
      <Text style={styles.title}>{ trip.name }</Text>
      <Text style={styles.date}>{ trip.departureDate }    { trip.departureTime }    { trip.type }</Text>
      <View lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
    </View>
  );
};

export default TripListItem;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 20
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 10,
  },
  date: {
    color: Colors.light.tint,
    fontWeight: 'bold'
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
  image: {
    width: '100%',
    aspectRatio: 2 / 1
  }
});