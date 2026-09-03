import Colors from '@/src/constants/colors';
import { useState } from 'react';
import {
  StyleProp,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
  Pressable,
  DimensionValue,
} from 'react-native';
import { haptics } from '@/src/constants/haptics';
import { contentWidth } from '@/src/constants/layout';
import { radii } from '@/src/constants/radii';
import { fontSize as fontSizes } from '@/src/constants/typography';
import { Eye, EyeOff } from 'lucide-react-native';

// Reusable single-line text field (e.g. trip name, destination).
// Controlled input: the caller owns the state and passes value + onChangeText.
// Handles the focus ring (border color when user tap on textbox), the red error border, and the show/hide toggle on password fields.
type TextBoxProps = {
  value: string; // current text (caller-owned state)
  onChangeText: (text: string) => void; // called with the new text on every keystroke
  placeholder?: string; // hint shown when empty
  placeholderTextColor?: string;
  color?: string; // text color
  backgroundColor?: string;
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  borderColorSelected?: string;
  marginVertical?: number;
  fontSize?: number;
  editable?: boolean;
  keyboardType?: TextInput['props']['keyboardType'];
  autoCapitalize?: TextInput['props']['autoCapitalize'];
  secureTextEntry?: boolean; // mask input for passwords
  maxLength?: number;
  style?: StyleProp<ViewStyle & TextStyle>; // per-use overrides (win over defaults)
  error?: boolean;
  borderColorError?: string;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export default function TextBox({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = Colors.textMuted,
  color = Colors.text,
  backgroundColor = Colors.card,
  width = contentWidth,
  height = 60,
  borderRadius = radii.lg,
  borderWidth = 1,
  borderColor = Colors.textMutedLight,
  borderColorSelected = Colors.tint,
  marginVertical = 10,
  fontSize = fontSizes.body,
  editable = true,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  secureTextEntry = false,
  maxLength,
  style,
  error,
  borderColorError = Colors.error,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: TextBoxProps) {
  const [focused, setFocused] = useState(false); // true while the field is being edited
  const [revealed, setRevealed] = useState(false); // password temporarily shown as plain text

  // Border precedence: an error outranks the focus ring, so a bad field stays red even user is correcting it
  const activeBorder = error ? borderColorError : focused ? borderColorSelected : borderColor;

  // A TextInput can't have children, so the wrapper exists purely to give the eye button something to be absolutely positioned against.
  return (
    <View style={{ width, alignSelf: 'center', justifyContent: 'center' }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        editable={editable}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry && !revealed} // The prop says "this is a password field"; `revealed` says "but show it right now".
        maxLength={maxLength}
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !editable }}
        onFocus={() => {
          setFocused(true);
          haptics.selection();
        }}
        onBlur={() => setFocused(false)}
        style={[
          {
            width: '100%',
            height,
            borderRadius,
            borderWidth,
            borderColor: activeBorder,
            marginVertical,
            backgroundColor,
            color,
            fontSize,
            alignSelf: 'center', // center within its parent, like LargeButton
            paddingHorizontal: 16, // keep text off the border
            paddingRight: 48, // clear the eye button; the specific edge wins over the shorthand above
          },
          style, // caller overrides come last so they win
        ]}
      />
      {/* Show/hide toggle, rendered only for password fields. */}
      {secureTextEntry ? (
        <Pressable
          onPress={() => setRevealed((r) => !r)}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 56,
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'box-only',
          }}
          accessibilityRole="button"
          accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
        >
          {revealed ? (
            <EyeOff size={20} color={Colors.textMutedLight} />
          ) : (
            <Eye size={20} color={Colors.textMutedLight} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
