import Colors from '@/src/constants/colors';
import { contentWidth } from '@/src/constants/layout';
import { radii } from '@/src/constants/radii';
import { spacing } from '@/src/constants/spacing';
import { fontSize as fontSizes, fontWeight } from '@/src/constants/typography';
import { haptics, type HapticRole } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { LucideIcon } from 'lucide-react-native';
import {
  Pressable,
  StyleProp,
  Text,
  TextStyle,
  View,
  ViewStyle,
  DimensionValue,
} from 'react-native';

// Reusable wide button (e.g. "Start Trip", "Login").
// Shows a text label, with an optional leading icon. Centers itself.
type LargeButtonProps = {
  label: string; // button text
  onPress: () => void;
  icon?: LucideIcon; // optional leading lucide icon
  color?: string; // text + icon color
  backgroundColor?: string;
  backgroundColorPressed?: string;
  width?: DimensionValue;
  height?: DimensionValue;
  marginVertical?: number;
  borderRadius?: number;
  fontSize?: number;
  haptic?: HapticRole;
  style?: StyleProp<ViewStyle>; // per-use container overrides
  textStyle?: StyleProp<TextStyle>; // per-use text overrides
  disabled?: boolean;
  disabledBackgroundColor?: string;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: ViewStyle['borderStyle'];
};

export default function LargeButton({
  label,
  onPress,
  icon: Icon,
  color = Colors.background,
  backgroundColor = Colors.tint,
  backgroundColorPressed = Colors.tintPressed,
  width = contentWidth,
  height = 60,
  marginVertical = spacing.sm,
  borderRadius = radii.lg,
  borderWidth = 0,
  borderColor = Colors.border,
  borderStyle = 'solid',
  fontSize = fontSizes.body,
  haptic = 'action',
  style,
  textStyle,
  disabled = false,
  disabledBackgroundColor = Colors.disabled,
}: LargeButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        haptics[haptic]();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [
        pressFeedback.control(pressed),
        {
          width,
          height,
          marginVertical,
          borderRadius,
          borderWidth,
          borderColor,
          borderStyle,
          flexDirection: 'row', // icon + text sit side by side
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center', // center the button within its parent
          gap: spacing.xxs * 2,
          backgroundColor: disabled
            ? disabledBackgroundColor
            : pressed
              ? backgroundColorPressed
              : backgroundColor,
        },
        style, // caller overrides come last so they win
      ]}
    >
      {/* pointerEvents none: keep the lucide/SVG icon from swallowing taps */}
      {Icon && (
        <View pointerEvents="none">
          <Icon color={color} size={fontSize + 2} />
        </View>
      )}
      <Text style={[{ color, fontSize, fontWeight: fontWeight.bold }, textStyle]}>{label}</Text>
    </Pressable>
  );
}
