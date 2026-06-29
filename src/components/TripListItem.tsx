import { Text, View } from '@/src/components/Themed';
import { Trip } from '@assets/dummydata/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Dot, Users } from 'lucide-react-native';
import { ImageBackground, StyleSheet } from 'react-native';
import Colors from '../constants/Colors';

//Fallback image used when a trip has no image of its own
export const defaultTripImage = 'https://imageio.forbes.com/specials-images/imageserve//62bdd4a21a6dc599d18bca9b/0x0.jpg?format=jpg&height=900&width=1600&fit=bounds';

type TripListItemProps = {
    trip: Trip;
}

//A single trip card: cover image with trip details overlaid at the bottom
const TripListItem = ({ trip }: TripListItemProps) => {
  return (
    <ImageBackground source={{ uri: trip.image || defaultTripImage }} style={styles.container}>
      {/* Dark gradient over the image bottom so the white text stays readable on any photo. */}
      <LinearGradient
        colors={['transparent', 'transparent', 'rgba(0, 0, 0, 1)']} locations={[0, 0.5, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      {/* Date pill */}
      <View style={[styles.infoContainer, { backgroundColor: Colors.theme.background }]}>
        <Calendar color={Colors.theme.tint} size='15'/>
        <Text style={styles.date}> { trip.departureDate }</Text>
      </View>
      <Text style={styles.title}>{ trip.name }</Text>
      {/* Meta row: members | time | type, separated by Dot icons */}
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
    borderColor: Colors.theme.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',          //clips the image + gradient to the rounded corners
    flex: 1,
    justifyContent: 'flex-end',
    aspectRatio: 5 / 3           //keeps a consistent card shape regardless of image size
  },
  infoContainer: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',     //shrink-wrap to content instead of stretching full width
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

//Shared styling for the meta-row icons
const iconProps = {
  color: Colors.theme.textMutedLight,
  size: 15,
};