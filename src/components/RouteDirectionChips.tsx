/**
 * @file RouteDirectionChips.tsx
 * @description The choice between a round trip's whole drive, its drive to its destination, and its
 * drive home. One is always picked
 */
import { StyleSheet, View } from 'react-native';
import Chip from '@/src/components/Chip';
import { spacing } from '@/src/constants/theme';
import type { RouteDirection } from '@/src/domain/route';

type RouteDirectionChipsProps = {
  value: RouteDirection;
  onChange: (direction: RouteDirection) => void; // also called for the one already picked
};

const RouteDirectionChips = ({ value, onChange }: RouteDirectionChipsProps) => (
  <View style={styles.row} accessibilityRole="radiogroup">
    <Chip
      label="Full trip"
      selected={value === 'full'}
      onPress={() => onChange('full')}
      testID="route-direction-full"
    />
    <Chip
      label="To destination"
      selected={value === 'outbound'}
      onPress={() => onChange('outbound')}
      testID="route-direction-outbound"
    />
    <Chip
      label="Return"
      selected={value === 'return'}
      onPress={() => onChange('return')}
      testID="route-direction-return"
    />
  </View>
);

export default RouteDirectionChips;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
