import { colors, spacing, fontSize, fontWeight, radii, contentWidth } from '@/src/constants/theme'
import { haptics, type HapticRole } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';

export type LargeButtonVariant = 'primary' | 'danger' | 'ghost' | 'dashed';

type VariantStyle = {
  color: string;
  backgroundColor: string;
  backgroundColorPressed: string;
  borderWidth: number;
  borderColor: string;
  borderStyle: ViewStyle['borderStyle'];
  haptic: HapticRole;
};

const VARIANTS: Record<LargeButtonVariant, VariantStyle> = {
  primary: {
    color: colors.background,
    backgroundColor: colors.tint,
    backgroundColorPressed: colors.tintPressed,
    borderWidth: 0,
    borderColor: colors.border,
    borderStyle: 'solid',
    haptic: 'action',
  },
  danger: {
    color: colors.error,
    backgroundColor: colors.border,
    backgroundColorPressed: colors.card,
    borderWidth: 0,
    borderColor: colors.border,
    borderStyle: 'solid',
    haptic: 'destructive',
  },
  ghost: {
    color: colors.textMutedLight,
    backgroundColor: colors.card,
    backgroundColorPressed: colors.textMuted,
    borderWidth: 0,
    borderColor: colors.border,
    borderStyle: 'solid',
    haptic: 'action',
  },
  dashed: {
    color: colors.textMutedLight,
    backgroundColor: colors.card,
    backgroundColorPressed: colors.textMuted,
    borderWidth: 1,
    borderColor: colors.textMutedLight,
    borderStyle: 'dashed',
    haptic: 'action',
  },
};

type LargeButtonProps = {
  label: string;
  onPress: () => void;
  variant?: LargeButtonVariant;
  icon?: LucideIcon;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export default function LargeButton({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  disabled = false,
  testID,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
}: LargeButtonProps) {
  const v = VARIANTS[variant];

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        haptics[v.haptic]();
        onPress();
      }}
      hitSlop={8}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        pressFeedback.control(pressed),
        {
          width: contentWidth,
          height: 60,
          marginVertical: spacing.sm,
          borderRadius: radii.lg,
          borderWidth: v.borderWidth,
          borderColor: v.borderColor,
          borderStyle: v.borderStyle,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
          gap: spacing.xxs * 2,
          backgroundColor: disabled
            ? colors.disabled
            : pressed
              ? v.backgroundColorPressed
              : v.backgroundColor,
        },
        style,
      ]}
    >
      {Icon && (
        <View pointerEvents="none">
          <Icon color={v.color} size={fontSize.body + 2} />
        </View>
      )}
      <Text
        style={[
          { color: v.color, fontSize: fontSize.body, fontWeight: fontWeight.bold },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
