import Colors from '@/src/constants/colors';
import { gradients } from '@/src/constants/gradients';
import { fontSize, fontWeight } from '@/src/constants/typography';
import { copy } from '@/src/constants/copy';
import savedTrips from '@/src/__fixtures__/savedTrips';
import TripListItem from '@/src/components/TripListItem';
import { LinearGradient } from 'expo-linear-gradient';
import { FlatList, StyleSheet, View, Text } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

// Renders list of all of the User's created and joined trips
export default function SavedTripsScreen() {
  const isEmpty = savedTrips.length === 0;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={savedTrips}
        renderItem={({ item }) => <TripListItem trip={item} />}
        contentContainerStyle={[
          { gap: 10, padding: 10, paddingBottom: useBottomTabBarHeight() + 10 },
          isEmpty && { flexGrow: 1, justifyContent: 'center' },
        ]}
        ListEmptyComponent={
          <View style={styles.container}>
            <Text style={styles.text}>{copy.savedTrips.emptyTitle}</Text>
            <Text style={styles.subtext}>{copy.savedTrips.emptySubtitle}</Text>
          </View>
        }
      />

      {/* Gradient header overlay: solid at the top, fading to transparent at the bottom */}
      <LinearGradient {...gradients.topFade} style={[styles.header]} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: Colors.text,
    fontSize: fontSize.section,
    fontWeight: fontWeight.medium,
  },
  subtext: {
    color: Colors.textMutedLight,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
  },
});
