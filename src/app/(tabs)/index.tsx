import Colors from '@/src/constants/Colors';
import trips from '@assets/dummydata/data/trips';
import TripListItem from '@components/TripListItem';
import { LinearGradient } from 'expo-linear-gradient';
import { FlatList, StyleSheet, View } from 'react-native';

//Renders list of all of the User's created and joined trips
export default function TripsScreen() {

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={trips}
        renderItem={({ item }) => <TripListItem trip={item}/> }
        contentContainerStyle={{ gap: 10, padding: 10, paddingBottom: 100 }}
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
});
