import Colors from '@/src/constants/Colors';
import { useState } from 'react';
import { StyleProp, TextInput, TextStyle, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

//Reusable single-line text field (e.g. trip name, destination).
//Controlled input: the caller owns the state and passes value + onChangeText.
type TextBoxProps = {
  value: string;                        //current text (caller-owned state)
  onChangeText: (text: string) => void; //called with the new text on every keystroke
  placeholder?: string;                 //hint shown when empty
  placeholderTextColor?: string;
  color?: string;                       //text colour
  backgroundColor?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  borderColorSelected?: string;
  marginBottom?: number,
  fontSize?: number;
  editable?: boolean;
  keyboardType?: TextInput['props']['keyboardType'];
  autoCapitalize?: TextInput['props']['autoCapitalize'];
  secureTextEntry?: boolean;            //mask input for passwords
  maxLength?: number;
  style?: StyleProp<ViewStyle & TextStyle>; //per-use overrides (win over defaults)
};

export default function TextBox({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = Colors.theme.textMuted,
  color = Colors.theme.text,
  backgroundColor = Colors.theme.card,
  width = 370,
  height = 60,
  borderRadius = 20,
  borderWidth = 1,
  borderColor = Colors.theme.textMutedLight,
  borderColorSelected = Colors.theme.tint,
  marginBottom = 30,
  fontSize = 18,
  editable = true,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  secureTextEntry = false,
  maxLength,
  style,
}: TextBoxProps) {
  const [focused, setFocused] = useState(false); //true while the field is being edited

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      editable={editable}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      secureTextEntry={secureTextEntry}
      maxLength={maxLength}
      onFocus={() => {
        setFocused(true) 
        Haptics.selectionAsync()
      }}
      onBlur={() => setFocused(false)}
      style={[
        {
          width,
          height,
          borderRadius,
          borderWidth,
          borderColor: focused ? borderColorSelected : borderColor,
          marginBottom,
          backgroundColor,
          color,
          fontSize,
          alignSelf: 'center',   //center within its parent, like LargeButton
          paddingHorizontal: 16, //keep text off the border
        },
        style, //caller overrides come last so they win
      ]}
    />
  );
}
