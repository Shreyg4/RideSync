import { Text, View, ImageBackground, Pressable, StyleSheet } from 'react-native';
import type { Trip } from '@/src/types/trip';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { gradients } from '@/src/constants/gradients';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Calendar, Dot, Users } from 'lucide-react-native';
import Colors from '@/src/constants/colors';
import { fontWeight } from '@/src/constants/typography';
import { radii } from '@/src/constants/radii';
import { tripImageSource } from '@/src/constants/tripImage';

type TripListItemProps = {
  trip: Trip;
};

// A single trip card: cover image with trip details overlaid at the bottom
const TripListItem = ({ trip }: TripListItemProps) => {
  return (
    <Pressable
      onPress={() => {
        // Haptic feedback, then navigate to the trip details screen
        haptics.action();
        router.push(`/trips/${trip.id}`);
      }}
      style={({ pressed }) => [pressFeedback.card(pressed)]}
    >
      <ImageBackground source={tripImageSource(trip.image)} style={styles.container}>
        {/* Dark gradient over the image bottom so the white text stays readable on any photo. */}
        <LinearGradient {...gradients.imageScrim} style={StyleSheet.absoluteFill} />
        {/* Date pill */}
        <View style={[styles.infoContainer, { backgroundColor: Colors.background }]}>
          <Calendar color={Colors.tint} size={15} />
          <Text style={styles.date}> {trip.departureDate}</Text>
        </View>
        <Text style={styles.title}>{trip.name}</Text>
        {/* Meta row: members | time | type, separated by Dot icons */}
        <View style={styles.infoContainer}>
          <Users {...iconProps} />
          <Text style={styles.info}> {trip.numMembers} members</Text>
          <Dot {...iconProps} />
          <Text style={styles.info}>{trip.departureTime}</Text>
          <Dot {...iconProps} />
          <Text style={styles.info}>{trip.duration}</Text>
        </View>
      </ImageBackground>
    </Pressable>
  );
};

export default TripListItem;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 20,
    overflow: 'hidden', // clips the image + gradient to the rounded corners
    flex: 1,
    justifyContent: 'flex-end',
    aspectRatio: 5 / 3, // keeps a consistent card shape regardless of image size
  },
  infoContainer: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start', // shrink-wrap to content instead of stretching full width
    padding: 6,
    borderRadius: radii.sm,
  },
  title: {
    color: Colors.text,
    fontSize: 25,
    fontWeight: fontWeight.bold,
    marginTop: 10,
  },
  date: {
    color: Colors.tint,
    fontWeight: 'bold',
  },
  info: {
    color: Colors.textMutedLight,
    fontWeight: 'bold',
  },
});

// Shared styling for the meta-row icons
const iconProps = {
  color: Colors.textMutedLight,
  size: 15,
};
