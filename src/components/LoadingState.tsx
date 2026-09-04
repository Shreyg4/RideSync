import { colors } from '@/src/constants/theme'
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type LoadingStateProps = {
  testID?: string;
};

export default function LoadingState({ testID }: LoadingStateProps) {
  return (
    <View style={styles.container} testID={testID}>
      <ActivityIndicator size="large" color={colors.tint} accessibilityLabel="Loading" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
