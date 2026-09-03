import Colors from '@/src/constants/colors';
import { haptics } from '@/src/constants/haptics';
import { contentWidth } from '@/src/constants/layout';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { radii } from '@/src/constants/radii';
import { spacing } from '@/src/constants/spacing';
import { fontSize } from '@/src/constants/typography';
import { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleProp, Text, ViewStyle } from 'react-native';

type FieldButtonProps = {
  text: string | null;
  placeholder: string;
  icon?: LucideIcon;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function FieldButton({
  text,
  placeholder,
  icon: Icon,
  onPress,
  style,
}: FieldButtonProps) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={text ?? placeholder}
      style={({ pressed }) => [
        pressFeedback.control(pressed),
        {
          width: contentWidth,
          height: 60,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: Colors.textMutedLight,
          backgroundColor: Colors.card,
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
      {Icon && <Icon size={20} color={Colors.textMutedLight} />}
      <Text style={{ fontSize: fontSize.body, color: text ? Colors.text : Colors.textMuted }}>
        {text ?? placeholder}
      </Text>
    </Pressable>
  );
}
