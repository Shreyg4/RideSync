import { Text, View } from '@/src/components/Themed';
import { Trip } from '@assets/dummydata/types';
import { Calendar, Dot, Users } from 'lucide-react-native';
import { ImageBackground, StyleSheet } from 'react-native';
import Colors from '../constants/Colors';

export const defaultTripImage = 'https://imageio.forbes.com/specials-images/imageserve//62bdd4a21a6dc599d18bca9b/0x0.jpg?format=jpg&height=900&width=1600&fit=bounds';

type TripListItemProps = {
    trip: Trip;
}

const TripListItem = ({ trip }: TripListItemProps) => {
  return (
    <ImageBackground source={{ uri: trip.image || defaultTripImage }} style={styles.container}>
      <View style={styles.infoContainer}>
        <Calendar color={Colors.light.tint} size='15'/> 
        <Text style={styles.date}> { trip.departureDate }</Text>
      </View>
      <Text style={styles.title}>{ trip.name }</Text>
      <View style={styles.infoContainer}>
        <Users color='gray' size='15'/>
        <Text style={styles.info}> { trip.numMembers } members</Text>
        <Dot color='gray' size='15'/>
        <Text style={styles.info}>{ trip.departureTime }</Text>
        <Dot color='gray' size='15'/>
        <Text style={styles.info}>{ trip.type }</Text>
      </View>
      <View lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
    </ImageBackground>
  );
};

export default TripListItem;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    flex: 1,
    justifyContent: 'flex-end',
    aspectRatio: 5 / 3
  },
  infoContainer: {
    backgroundColor: '',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    padding: 6,
    borderRadius: 10,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    marginTop: 10
  },
  date: {
    backgroundColor: 'black',
    color: Colors.light.tint,
    fontWeight: 'bold',
    
  },
  info: {
    color: 'gray',
    fontWeight: 'bold',
  },
});