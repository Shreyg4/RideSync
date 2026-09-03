import type { Trip } from '@/src/types/trip';
import { spacing } from '@/src/constants/spacing';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { FlatList, StyleSheet, View } from 'react-native';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import TopFade from './TopFade';
import TripListItem from './TripListItem';

type TripListProps = {
  data: Trip[];
  emptyTitle: string;
  emptySubtitle?: string;
  loading?: boolean;
  bottomOffset?: number;
  testID?: string;
};

export default function TripList({
  data,
  emptyTitle,
  emptySubtitle,
  loading = false,
  bottomOffset,
  testID,
}: TripListProps) {
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
        keyExtractor={(trip) => trip.id.toString()}
        renderItem={({ item }) => <TripListItem trip={item} />}
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
