import { gradients } from '@/src/constants/gradients';
import { spacing } from '@/src/constants/spacing';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

type TopFadeProps = {
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export default function TopFade({ height, style }: TopFadeProps) {
  return (
    <LinearGradient
      {...gradients.topFade}
      pointerEvents="none"
      style={[styles.fade, height === undefined ? null : { height }, style]}
    />
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
});
