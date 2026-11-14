/**
 * @file LabeledSlider.tsx
 * @description A slider with its title and current value above it. The value label follows the
 * thumb while it's dragged, and the caller hears separately when the drag ends, so work like a
 * search runs once per drag instead of on every step
 */
import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';
import type { AccessibilityActionEvent, StyleProp, ViewStyle } from 'react-native';
import { haptics } from '@/src/constants/haptics';
import { colors, fontSize, fontWeight, spacing } from '@/src/constants/theme';

type LabeledSliderProps = {
  label: string; // what the slider sets, like "Time into the drive"
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number; // every value the slider gives is a whole number of these from the minimum
  formatValue: (value: number) => string; // the text shown beside the label and read aloud
  onValueChange: (value: number) => void; // on every step while dragging
  onSlidingComplete?: (value: number) => void; // once, when the thumb is let go
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// Keeps a value on the slider's steps and inside its range. The native slider can report values
// a hair off a step, like 0.30000000000000004
export const snapToStep = (value: number, minimum: number, maximum: number, step: number) => {
  if (maximum <= minimum) return minimum;
  const steps = step > 0 ? Math.round((value - minimum) / step) : 0;
  const snapped = step > 0 ? minimum + steps * step : value;
  return Math.min(Math.max(snapped, minimum), maximum);
};

const LabeledSlider = ({
  label,
  value,
  minimumValue,
  maximumValue,
  step,
  formatValue,
  onValueChange,
  onSlidingComplete,
  disabled = false,
  style,
  testID,
}: LabeledSliderProps) => {
  const snap = (next: number) => snapToStep(next, minimumValue, maximumValue, step);
  const current = snap(value);
  const shown = formatValue(current);

  // Screen readers step it with swipes up and down. A step there is a whole change, so the caller
  // hears it as both a move and a release
  const onAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    const direction = nativeEvent.actionName === 'increment' ? 1 : -1;
    const next = snap(current + direction * step);
    if (next === current) return;
    haptics.selection();
    onValueChange(next);
    onSlidingComplete?.(next);
  };

  return (
    <View style={style}>
      {/* The slider says all of this itself, so screen readers skip the labels */}
      <View
        style={styles.labels}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} testID={testID && `${testID}-value`}>
          {shown}
        </Text>
      </View>
      <Slider
        // The library treats 0 as no value and ignores it, so a slider set back to 0 by the caller
        // wouldn't move. The smallest number above 0 snaps to the same place
        value={current === 0 ? Number.MIN_VALUE : current}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        onValueChange={(next) => onValueChange(snap(next))}
        onSlidingComplete={onSlidingComplete && ((next) => onSlidingComplete(snap(next)))}
        disabled={disabled}
        tapToSeek
        minimumTrackTintColor={colors.tint}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.tint}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: shown }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        style={styles.slider}
        testID={testID}
      />
    </View>
  );
};

export default LabeledSlider;

const styles = StyleSheet.create({
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xxs,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
  },
  value: {
    color: colors.tint,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
  },
  // Taller than the track, so the thumb is easy to catch
  slider: {
    height: 36,
  },
});
