import Colors from '@/src/constants/Colors';
import * as Haptics from 'expo-haptics';
import { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleProp, Text, TextStyle, ViewStyle } from 'react-native';
import { DimensionValue } from 'react-native';

//Reusable wide button (e.g. "Start Trip", "Login").
//Shows a text label, with an optional leading icon. Centers itself.
type LargeButtonProps = {
  label: string;               //button text
  onPress: () => void;
  icon?: LucideIcon;           //optional leading lucide icon
  color?: string;              //text + icon color
  backgroundColor?: string;
  backgroundColorPressed?: string;
  width?: DimensionValue;
  height?: DimensionValue;
  marginVertical?: number,
  borderRadius?: number;
  fontSize?: number;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
  style?: StyleProp<ViewStyle>;   //per-use container overrides
  textStyle?: StyleProp<TextStyle>; //per-use text overrides
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
  color = Colors.theme.background,
  backgroundColor = Colors.theme.tint,
  backgroundColorPressed = Colors.theme.tintPressed,
  width = '95%',
  height = 60,
  marginVertical = 15,
  borderRadius = 20,
  borderWidth = 0,
  borderColor = Colors.theme.border,
  borderStyle = 'solid',
  fontSize = 18,
  hapticStyle = Haptics.ImpactFeedbackStyle.Heavy,
  style,
  textStyle,
  disabled = false,
  disabledBackgroundColor = Colors.theme.disabled,

}: LargeButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        //Haptic feedback for the button
        Haptics.impactAsync(hapticStyle);
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width,
          height,
          marginVertical,
          borderRadius,
          borderWidth,
          borderColor,
          borderStyle,
          flexDirection: 'row',     //icon + text sit side by side
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',      //center the button within its parent
          gap: 8,                   //space between icon and text
          backgroundColor: disabled ? disabledBackgroundColor : pressed ?  backgroundColorPressed : backgroundColor,
        },
        style, //caller overrides come last so they win
      ]}>
      {Icon && <Icon color={color} size={fontSize + 2} />}
      <Text style={[{ color, fontSize, fontWeight: '700' }, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}
