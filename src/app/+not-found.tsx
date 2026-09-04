import { Link, Stack } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight } from '@/src/constants/theme'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize.section,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  link: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  linkText: {
    fontSize: fontSize.caption,
    color: colors.tint,
  },
});
