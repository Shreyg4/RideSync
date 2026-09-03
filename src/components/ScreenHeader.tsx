import Colors from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { fontSize, fontWeight } from '@/src/constants/typography';
import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SmallButton from './SmallButton';

type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  applyTopInset?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function ScreenHeader({
  title,
  onBack,
  rightAction,
  applyTopInset = true,
  style,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, applyTopInset && { marginTop: insets.top }, style]}>
      <Text style={styles.title}>{title}</Text>
      {onBack ? (
        <View style={styles.left}>
          <SmallButton icon={ChevronLeft} onPress={onBack} accessibilityLabel="Go back" />
        </View>
      ) : null}
      {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: fontSize.sheetTitle,
    fontWeight: fontWeight.semibold,
    alignSelf: 'center',
  },
  left: {
    position: 'absolute',
    left: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  right: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
