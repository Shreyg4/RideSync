import Colors from '@/src/constants/colors';
import { copy } from '@/src/constants/copy';
import trips from '@/src/__fixtures__/trips';
import TripListItem from '@/src/components/TripListItem';
import { LinearGradient } from 'expo-linear-gradient';
import { FlatList, StyleSheet, View, Text } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

// Renders list of all of the User's created and joined trips
export default function TripsScreen() {
  const isEmpty = trips.length === 0;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={trips}
        renderItem={({ item }) => <TripListItem trip={item} />}
        contentContainerStyle={[
          { gap: 10, padding: 10, paddingBottom: useBottomTabBarHeight() + 10 },
          isEmpty && { flexGrow: 1, justifyContent: 'center' },
        ]}
        ListEmptyComponent={
          <View style={styles.container}>
            <Text style={styles.text}>{copy.trips.emptyTitle}</Text>
            <Text style={styles.subtext}>{copy.trips.emptySubtitle}</Text>
          </View>
        }
      />

      {/* Gradient header overlay: solid at the top, fading to transparent at the bottom */}
      <LinearGradient
        colors={[Colors.theme.background, Colors.theme.background, 'transparent']}
        locations={[0, 0, 1]}
        style={[styles.header]}
      />
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: Colors.theme.text,
    fontSize: 20,
    fontWeight: 500,
  },
  subtext: {
    color: Colors.theme.textMutedLight,
    fontSize: 15,
    fontWeight: 200,
  },
});
