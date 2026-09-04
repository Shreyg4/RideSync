import { colors, spacing, fontSize, radii, contentWidth } from '@/src/constants/theme'
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleProp, Text, ViewStyle } from 'react-native';

type FieldButtonProps = {
  text: string | null;
  placeholder: string;
  icon?: LucideIcon;
  onPress: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export default function FieldButton({
  text,
  placeholder,
  icon: Icon,
  onPress,
  testID,
  style,
}: FieldButtonProps) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={text ?? placeholder}
      style={({ pressed }) => [
        pressFeedback.control(pressed),
        {
          width: contentWidth,
          height: 60,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.textMutedLight,
          backgroundColor: colors.card,
          marginVertical: spacing.sm,
          alignSelf: 'center',
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {Icon && <Icon size={20} color={colors.textMutedLight} />}
      <Text style={{ fontSize: fontSize.body, color: text ? colors.text : colors.textMuted }}>
        {text ?? placeholder}
      </Text>
    </Pressable>
  );
}
