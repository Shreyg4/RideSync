import { colors, radii } from '@/src/constants/theme'
import { haptics, type HapticRole } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';

// Reusable circular icon button (e.g. the header "+" button).
// All sizing/colours are props so the same component works anywhere.
type SmallButtonProps = {
  icon: LucideIcon; // pass the lucide icon component itself
  onPress: () => void;
  color?: string;
  backgroundColor?: string;
  size?: number;
  diameter?: number;
  haptic?: HapticRole;
  testID?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>; // per-use overrides
};

export default function SmallButton({
  icon: Icon,
  onPress,
  color = colors.tint,
  backgroundColor = colors.border,
  size = 32,
  diameter = 48,
  haptic = 'action',
  testID,
  accessibilityLabel,
  accessibilityHint,
  style,
}: SmallButtonProps) {
  return (
    <Pressable
      onPress={() => {
        haptics[haptic]();
        onPress();
      }}
      hitSlop={8} // expands the tap target beyond the small circle
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        pressFeedback.control(pressed),
        {
          width: diameter,
          height: diameter,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
        },
        style, // caller overrides come last so they win
      ]}
    >
      {/* pointerEvents none: keep the lucide/SVG icon from swallowing taps */}
      <View pointerEvents="none">
        <Icon color={color} size={size} />
      </View>
    </Pressable>
  );
}
