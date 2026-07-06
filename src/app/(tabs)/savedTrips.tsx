import Colors from '@/src/constants/Colors';
import archive from '@/assets/dummydata/data/archive';
import TripListItem from '@components/TripListItem';
import { LinearGradient } from 'expo-linear-gradient';
import { FlatList, StyleSheet, View, Text } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'

//Renders list of all of the User's created and joined trips
export default function savedTrips() {
  const isEmpty = archive.length === 0;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={archive}
        renderItem={({ item }) => <TripListItem trip={item}/> }
        contentContainerStyle={[ {gap: 10, padding: 10, paddingBottom: useBottomTabBarHeight() + 10}, isEmpty && { flexGrow: 1, justifyContent: 'center' }]}
        ListEmptyComponent={
          <View style={styles.container}>
            <Text style={styles.text}>No Archived Journeys</Text>
          </View>}
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
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: Colors.theme.text,
    fontSize: 20,
    fontWeight: 500
  },
});
