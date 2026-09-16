import { colors, spacing, gradients } from '@/src/constants/theme';
import React from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

type ScreenProps = {
  children: React.ReactNode;
  gradient?: boolean;
  scroll?: boolean;
  applyTopInset?: boolean;
  bottomOffset?: number;
  center?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export default function Screen({
  children,
  gradient = false,
  scroll = true,
  applyTopInset = false,
  bottomOffset = 0,
  center = false,
  style,
  contentContainerStyle,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const container = [styles.container, gradient && styles.transparent, applyTopInset && { paddingTop: insets.top }, style];

  const content = [
    { paddingBottom: insets.bottom + bottomOffset + spacing.sm },
    center && styles.centered,
    contentContainerStyle,
  ];

  const body = !scroll ? (
    <View testID={testID} style={[container, content]}>{children}</View>
  ) : (
    <KeyboardAwareScrollView 
      testID={testID}
      style={container}
      contentContainerStyle={content}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      bottomOffset={bottomOffset}
    >
      {children}
    </KeyboardAwareScrollView>
  );

  if (!gradient) return body;

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        {...gradients.cardToBackground()}
        style={StyleSheet.absoluteFill}
      />
      {body}
    </View>
  );
}

export { ScrollView };

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  transparent: { 
    backgroundColor: 'transparent' 
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
