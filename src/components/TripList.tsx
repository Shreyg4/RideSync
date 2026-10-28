import { spacing } from '@/src/constants/theme';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { FlatList, StyleSheet, View } from 'react-native';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import TopFade from './TopFade';

type TripListProps<T extends { id: number }> = {
  data: T[];
  renderItem: (item: T) => React.ReactElement;
  emptyTitle: string;
  emptySubtitle?: string;
  loading?: boolean;
  bottomOffset?: number;
  testID?: string;
};

export default function TripList<T extends { id: number }>({
  data,
  renderItem,
  emptyTitle,
  emptySubtitle,
  loading = false,
  bottomOffset,
  testID,
}: TripListProps<T>) {
  const tabBarHeight = useBottomTabBarHeight();
  const paddingBottom = (bottomOffset ?? tabBarHeight) + spacing.sm;
  const isEmpty = data.length === 0;

  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingState testID={testID ? `${testID}-loading` : undefined} />
        <TopFade height={12} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        testID={testID}
        data={data}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => renderItem(item)}
        contentContainerStyle={[
          { gap: spacing.sm, padding: spacing.sm, paddingBottom },
          isEmpty && styles.emptyContent,
        ]}
        ListEmptyComponent={<EmptyState title={emptyTitle} subtitle={emptySubtitle} />}
      />
      <TopFade height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
