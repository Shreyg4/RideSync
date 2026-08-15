import { router } from 'expo-router';
import { Text, View, Pressable, StyleSheet } from 'react-native'
import { Dot } from 'lucide-react-native';
import { Location } from '@/assets/dummydata/types'
import * as Haptics from 'expo-haptics';
import Colors from '../constants/Colors';

type StopListItemProps = {
    location: Location;
}

const StopListItem = ({ location }: StopListItemProps) => {
  return (
    <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/journeys')
        }}
        style={({ pressed }) => [
          {
            transform: [{ scale: pressed ? 0.95 : 1 }],
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <View style={styles.container}>
          <Text style={styles.name}>{location.name}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.subtext}>{location.address}</Text>
            <Dot {...iconProps}/>
            <Text style={styles.subtext}>{location.type}</Text>
          </View>
        </View>
    </Pressable>
  );
};

export default StopListItem;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.theme.tintmid,
    borderRadius: 20,
    margin: 10,
    padding: 10
  },
  name: {
    color: Colors.theme.textMuted,
    fontSize: 30,
    fontWeight: 700,
  },
  subtext: {
    fontSize: 15,
    fontWeight: 300
  },
  infoRow: {
    color: Colors.theme.textMuted,
    flexDirection: 'row',
  }
});
const iconProps = {
  color: Colors.theme.textMuted,
  size: 15,
};

