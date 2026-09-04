import { colors, spacing, fontSize, fontWeight } from '@/src/constants/theme'
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

type ErrorTextProps = {
  message?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export default function ErrorText({
  message,
  onRetry,
  retryLabel = 'Try again',
  testID,
  style,
}: ErrorTextProps) {
  if (!message) return null;

  return (
    <View style={[styles.row, style]} testID={testID}>
      <Text style={styles.text} accessibilityRole="alert">
        {message}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={retryLabel}>
          <Text style={styles.retry}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  text: {
    color: colors.error,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
  },
  retry: {
    color: colors.tint,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
  },
});
