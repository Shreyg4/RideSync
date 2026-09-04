import { colors, spacing } from '@/src/constants/theme'
import React from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenProps = {
  children: React.ReactNode;
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
  scroll = true,
  applyTopInset = false,
  bottomOffset = 0,
  center = false,
  style,
  contentContainerStyle,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const container = [styles.container, applyTopInset && { paddingTop: insets.top }, style];

  const content = [
    { paddingBottom: insets.bottom + bottomOffset + spacing.sm },
    center && styles.centered,
    contentContainerStyle,
  ];

  if (!scroll) {
    return (
      <View testID={testID} style={[container, content]}>
        {children}
      </View>
    );
  }

  return (
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
}

export { ScrollView };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
