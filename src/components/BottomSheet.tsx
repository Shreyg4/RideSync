/**
 * @file BottomSheet.tsx
 * @description A sheet across the bottom of a full-screen map, edge to edge with its top corners
 * rounded. It runs under the phone's bottom edge and pads its contents above it, so a swipe meant for
 * the phone never lands on a control
 */
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import type { ReactNode } from 'react';
import { colors, radii, spacing } from '@/src/constants/theme';

type BottomSheetProps = {
  bottomInset?: number; // the phone's own space along the bottom edge, like the home indicator
  onLayout?: (event: LayoutChangeEvent) => void; // its height includes bottomInset
  testID?: string;
  children: ReactNode;
};

const BottomSheet = ({ bottomInset = 0, onLayout, testID, children }: BottomSheetProps) => (
  <View
    style={[styles.sheet, { paddingBottom: spacing.md + bottomInset }]}
    onLayout={onLayout}
    testID={testID}
  >
    {children}
  </View>
);

export default BottomSheet;

const styles = StyleSheet.create({
  sheet: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.card,
  },
});
