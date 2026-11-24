import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Maximize2 } from 'lucide-react-native';
import React from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import EmptyState from '@/src/components/EmptyState';
import ErrorText from '@/src/components/ErrorText';
import ItineraryRowItem, { itineraryRowKey } from '@/src/components/ItineraryRowItem';
import LoadingState from '@/src/components/LoadingState';
import ScreenHeader from '@/src/components/ScreenHeader';
import StopsMap from '@/src/components/StopsMap';
import { colors, fontSize, gradients, radii, spacing } from '@/src/constants/theme';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { itineraryRows, timeline } from '@/src/domain/rules';
import { useAsync } from '@/src/hooks/useAsync';
import { useTripRoute } from '@/src/hooks/useTripRoute';
import { toSavedTrip } from '@/src/lib/tripMapper';
import { getSavedTrip } from '@/src/services/tripService';

// A saved trip's whole itinerary, as it was last planned. Nothing here can be changed: re-creating
// the trip makes a new trip with these stops, and that one can be edited
const SavedItineraryScreen = () => {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const savedTripId = Number(Array.isArray(id) ? id[0] : id);

  const { data, loading, error } = useAsync(
    async () => {
      if (!Number.isInteger(savedTripId)) return null;
      const row = await getSavedTrip(savedTripId);
      return row ? toSavedTrip(row) : null;
    },
    [savedTripId],
    'SavedItineraryScreen.load'
  );

  // Older saved trips have no start, so their days count from today
  const rows = data
    ? itineraryRows(data.stops, data.tripType, data.startsAt ?? new Date(), false)
    : [];
  const segments = timeline(rows);

  // Not a live trip, so the route is fetched without being saved to one
  const route = useTripRoute(null, data?.stops, data?.tripType);

  const openMap = () => {
    haptics.action();
    router.push(`/savedTrips/${savedTripId}/map`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View>
        <LinearGradient
          pointerEvents="none"
          {...gradients.cardToBackground()}
          style={StyleSheet.absoluteFill}
        />
        <ScreenHeader title="Itinerary" onBack={() => router.back()} />
        {data && data.stops.length > 0 ? (
          <View style={styles.mapBox}>
            {/* The preview only shows the route; the full-screen map is where it can be moved */}
            <View pointerEvents="none" style={styles.mapPreview}>
              <StopsMap stops={data.stops} route={route.route} testID="saved-itinerary-map" />
            </View>
            <Pressable
              onPress={openMap}
              accessibilityRole="button"
              accessibilityLabel="Open map"
              style={({ pressed }) => [StyleSheet.absoluteFill, pressFeedback.card(pressed)]}
              testID="saved-itinerary-open-map"
            >
              <View style={styles.expandHint}>
                <Maximize2 color={colors.text} size={18} />
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>

      {!data ? (
        loading ? (
          <LoadingState testID="saved-itinerary-loading" />
        ) : (
          <EmptyState
            title={error ? "Couldn't load itinerary" : 'Trip not found'}
            subtitle={error ?? undefined}
          />
        )
      ) : (
        <FlatList
          data={rows}
          keyExtractor={itineraryRowKey}
          renderItem={({ item, index }) => (
            <ItineraryRowItem row={item} segment={segments[index]} highlightKeyStops />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingLeft: spacing.xs,
            paddingBottom: insets.bottom + spacing.sm,
          }}
          ListHeaderComponent={
            <>
              <ErrorText message={route.error} onRetry={route.retry} testID="saved-route-error" />
              <Text style={styles.note} testID="saved-itinerary-note">
                Re-create this trip to edit its itinerary
              </Text>
            </>
          }
          ListEmptyComponent={
            <EmptyState title="Not planned" subtitle="This trip had no stops when it was saved." />
          }
          testID="saved-itinerary-list"
        />
      )}
    </View>
  );
};

export default SavedItineraryScreen;

const styles = StyleSheet.create({
  note: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  mapBox: {
    height: 220,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  mapPreview: {
    flex: 1,
  },
  expandHint: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
});
