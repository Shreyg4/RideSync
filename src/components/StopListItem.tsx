import { Text, View, Pressable, StyleSheet } from 'react-native';
import { Dot } from 'lucide-react-native';
import type { Location } from '@/src/types/trip';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import Colors from '@/src/constants/colors';
import { radii } from '@/src/constants/radii';
import { spacing } from '@/src/constants/spacing';
import { fontSize, fontWeight } from '@/src/constants/typography';

type StopListItemProps = {
  location: Location;
  onPress?: () => void;
  testID?: string;
};

const StopListItem = ({ location, onPress, testID }: StopListItemProps) => {
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        haptics.action();
        onPress?.();
      }}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${location.name}, ${location.address}`}
      style={({ pressed }) => [pressFeedback.card(pressed)]}
    >
      <View style={styles.container}>
        <Text style={styles.name}>{location.name}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.subtext}>{location.address}</Text>
          <Dot {...iconProps} />
          <Text style={styles.subtext}>{location.type}</Text>
        </View>
      </View>
    </Pressable>
  );
};

export default StopListItem;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: radii.lg,
    margin: spacing.sm,
    padding: spacing.sm,
  },
  name: {
    color: Colors.text,
    fontSize: fontSize.sheetTitle,
    fontWeight: fontWeight.bold,
  },
  subtext: {
    color: Colors.textMutedLight,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
  },
  infoRow: {
    flexDirection: 'row',
  },
});
const iconProps = {
  color: Colors.textMutedLight,
  size: 15,
};
