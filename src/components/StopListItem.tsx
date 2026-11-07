import { Text, View, Pressable, StyleSheet } from 'react-native';
import { Dot } from 'lucide-react-native';
import type { TripStop } from '@/src/types/trip';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { colors, spacing, fontSize, fontWeight, radii } from '@/src/constants/theme';
import { stopLabel } from '@/src/domain/rules';

type StopListItemProps = {
  stop: TripStop;
  startsReturn?: boolean; // shows the "Return" heading above this stop
  onPress?: () => void;
  testID?: string;
};

const StopListItem = ({ stop, startsReturn = false, onPress, testID }: StopListItemProps) => {
  const label = stopLabel(stop);

  return (
    <>
      {startsReturn ? (
        <Text style={styles.returnHeading} accessibilityRole="header">
          Return
        </Text>
      ) : null}
      <Pressable
        disabled={!onPress}
        onPress={() => {
          haptics.action();
          onPress?.();
        }}
        testID={testID}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={[stop.name, stop.address, label].filter(Boolean).join(', ')}
        style={({ pressed }) => [pressFeedback.card(pressed)]}
      >
        <View style={styles.container}>
          <Text style={styles.name}>{stop.name}</Text>
          <View style={styles.infoRow}>
            {stop.address ? (
              <>
                <Text style={[styles.subtext, styles.address]} numberOfLines={1}>
                  {stop.address}
                </Text>
                <Dot {...iconProps} />
              </>
            ) : null}
            <Text style={styles.subtext}>{label}</Text>
          </View>
        </View>
      </Pressable>
    </>
  );
};

export default StopListItem;

const styles = StyleSheet.create({
  returnHeading: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    margin: spacing.sm,
    padding: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.sheetTitle,
    fontWeight: fontWeight.bold,
  },
  subtext: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
  },
  // Long addresses shrink so the label after them stays on screen
  address: {
    flexShrink: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
const iconProps = {
  color: colors.textMutedLight,
  size: 15,
};
