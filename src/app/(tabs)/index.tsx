import { Text, View } from '@/src/components/Themed';
import { Image, StyleSheet } from 'react-native';
import trips from '../../../dummydata/data/trips';
import Colors from '../../constants/Colors';

const trip = trips[0];

export default function TabOneScreen() {
  return (
    <View style={styles.container}>
      <Image source={{uri: trip.image ?? undefined}} style={styles.image} />
      <Text style={styles.title}>{ trip.name }</Text>
      <Text style={styles.date}>{ trip.departureDate }</Text>
      <View lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
    </View>
  );
}

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
