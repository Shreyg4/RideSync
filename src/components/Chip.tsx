import { Pressable, StyleSheet, Text } from 'react-native';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { colors, fontSize, fontWeight, radii, spacing } from '@/src/constants/theme';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

export default function Chip({ label, selected, onPress, testID }: ChipProps) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      hitSlop={4}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressFeedback.control(pressed),
      ]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.card,
    borderColor: colors.textMutedLight,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  selected: {
    backgroundColor: colors.tint,
    borderColor: colors.tint,
  },
  label: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
  },
  selectedLabel: {
    color: colors.background,
  },
});
