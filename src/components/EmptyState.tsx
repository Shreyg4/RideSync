import { colors, spacing, fontSize, fontWeight } from '@/src/constants/theme'
import { StyleSheet, Text, View } from 'react-native';

type EmptyStateProps = {
  title: string;
  subtitle?: string;
  testID?: string;
};

export default function EmptyState({ title, subtitle, testID }: EmptyStateProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.section,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    textAlign: 'center',
  },
});
