import Colors from '@/src/constants/colors';
import * as Haptics from 'expo-haptics';
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
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={text ?? placeholder}
      style={({ pressed }) => [
        {
          width: '95%',
          height: 60,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: Colors.theme.textMutedLight,
          backgroundColor: Colors.theme.card,
          marginVertical: 10,
          alignSelf: 'center',
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {Icon && <Icon size={20} color={Colors.theme.textMutedLight} />}
      <Text style={{ fontSize: 18, color: text ? Colors.theme.text : Colors.theme.textMuted }}>
        {text ?? placeholder}
      </Text>
    </Pressable>
  );
}
