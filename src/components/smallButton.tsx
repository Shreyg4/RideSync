import Colors from '@/src/constants/Colors';
import * as Haptics from 'expo-haptics';
import { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleProp, ViewStyle } from 'react-native';

//Reusable circular icon button (e.g. the header "+" button).
//All sizing/colours are props so the same component works anywhere.
type SmallButtonProps = {
  icon: LucideIcon;            //pass the lucide icon component itself
  onPress: () => void;
  color?: string;
  backgroundColor?: string;
  size?: number;
  diameter?: number;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
  style?: StyleProp<ViewStyle>; //per-use overrides
};

export default function SmallButton({
  icon: Icon,
  onPress,
  color = Colors.theme.tint,
  backgroundColor = Colors.theme.card,
  size = 32,
  diameter = 48,
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  style,
}: SmallButtonProps) {
  return (
    <Pressable
      onPress={() => {
        //Haptic feedback for the button
        Haptics.impactAsync(hapticStyle);
        onPress();
      }}
      hitSlop={8} //expands the tap target beyond the small circle
      style={({ pressed }) => [
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
          opacity: pressed ? 0.6 : 1, //press feedback
        },
        style, //caller overrides come last so they win
      ]}>
      <Icon color={color} size={size} />
    </Pressable>
  );
}
