import { Text, View } from '@/src/components/Themed';
import { Trip } from '@assets/dummydata/types';
import { LinearGradient } from 'expo-linear-gradient';
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
      <LinearGradient 
        colors={['transparent', 'transparent', 'rgba(0, 0, 0, 1)']} locations={[0, 0.5, 0.8]} 
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.infoContainer, { backgroundColor: Colors.theme.background }]}>
        <Calendar color={Colors.theme.tint} size='15'/> 
        <Text style={styles.date}> { trip.departureDate }</Text>
      </View>
      <Text style={styles.title}>{ trip.name }</Text>
      <View style={styles.infoContainer}>
        <Users {...iconProps}/>
        <Text style={styles.info}> { trip.numMembers } members</Text>
        <Dot {...iconProps}/>
        <Text style={styles.info}>{ trip.departureTime }</Text>
        <Dot {...iconProps}/>
        <Text style={styles.info}>{ trip.type }</Text>
      </View>
    </ImageBackground>
  );
};

export default TripListItem;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.theme.background,
    borderColor: Colors.theme.tint,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    flex: 1,
    justifyContent: 'flex-end',
    aspectRatio: 5 / 3
  },
  infoContainer: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    padding: 6,
    borderRadius: 10,
  },
  title: {
    color: Colors.theme.text, 
    fontSize: 25,
    fontWeight: '700',
    marginTop: 10
  },
  date: {
    color: Colors.theme.tint,
    fontWeight: 'bold',
    
  },
  info: {
    color: Colors.theme.textMutedLight,
    fontWeight: 'bold',
  },
});

const iconProps = {
  color: Colors.theme.textMutedLight,
  size: 15,
};