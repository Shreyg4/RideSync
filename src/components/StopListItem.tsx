import { Text, View, Pressable, StyleSheet } from 'react-native';
import { Dot } from 'lucide-react-native';
import type { TripStop } from '@/src/types/trip';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { colors, spacing, fontSize, fontWeight, radii } from '@/src/constants/theme';
import { stopLabel } from '@/src/domain/rules';

type StopListItemProps = {
  stop: TripStop;
  label?: string; // replaces the label worked out from the stop
  highlighted?: boolean; // tints the border
  compact?: boolean; // less space around the card, for short lists
  detail?: string | null; // one more line under the card's details, like when the group gets there
  onPress?: () => void;
  testID?: string;
};

const StopListItem = ({
  stop,
  label = stopLabel(stop),
  highlighted = false,
  compact = false,
  detail,
  onPress,
  testID,
}: StopListItemProps) => {
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        haptics.action();
        onPress?.();
      }}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[stop.name, stop.address, label, detail].filter(Boolean).join(', ')}
      style={({ pressed }) => [pressFeedback.card(pressed)]}
    >
      <View
        style={[styles.container, compact && styles.compact, highlighted && styles.highlighted]}
      >
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
        {detail ? (
          <Text style={[styles.subtext, styles.detail]} testID={testID && `detail-${testID}`}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
};

export default StopListItem;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    margin: spacing.xs,
    padding: spacing.lg,
    // Always there, so a highlighted card is the same size as the rest
    borderWidth: 1,
    borderColor: 'transparent',
  },
  compact: {
    marginHorizontal: 0,
    marginVertical: spacing.xxs / 2,
  },
  highlighted: {
    borderColor: colors.tint,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.body,
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
  detail: {
    marginTop: spacing.xxs,
  },
});
const iconProps = {
  color: colors.textMutedLight,
  size: 15,
};
