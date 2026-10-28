import { Text, View, ImageBackground, Pressable, StyleSheet } from 'react-native';
import type { SavedTrip } from '@/src/types/trip';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, fontWeight, radii, gradients } from '@/src/constants/theme';
import { tripImageSource } from '@/src/constants/tripImage';
import { tripTypeLabel } from '../domain/rules';

type SavedTripListItemProps = {
  savedTrip: SavedTrip;
};

// A single trip card: cover image with trip details overlaid at the bottom
const SavedTripListItem = ({ savedTrip }: SavedTripListItemProps) => {
  return (
    <Pressable
      onPress={() => {
        // Haptic feedback, then navigate to the trip details screen
        haptics.action();
        router.push(`/savedTrips/${savedTrip.id}`);
      }}
      style={({ pressed }) => [pressFeedback.card(pressed)]}
    >
      <ImageBackground source={tripImageSource(savedTrip.image)} style={styles.container}>
        {/* Dark gradient over the image bottom so the white text stays readable on any photo. */}
        <LinearGradient
          pointerEvents="none"
          {...gradients.imageScrim}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.title}>{savedTrip.name}</Text>
        {/* Meta row: just type for a saved trip */}
        <View style={styles.infoContainer}>
          <Text style={styles.info}>{tripTypeLabel(savedTrip.tripType)}</Text>
        </View>
      </ImageBackground>
    </Pressable>
  );
};

export default SavedTripListItem;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderColor: colors.border,
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
    color: colors.text,
    fontSize: 25,
    fontWeight: fontWeight.bold,
    marginTop: 10,
  },
  date: {
    color: colors.tint,
    fontWeight: 'bold',
  },
  info: {
    color: colors.textMutedLight,
    fontWeight: 'bold',
  },
});
