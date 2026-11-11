import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import React, { useCallback, useRef, useState } from 'react';
import { Maximize2, Settings } from 'lucide-react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmptyState from '@/src/components/EmptyState';
import ErrorText from '@/src/components/ErrorText';
import ItineraryRowItem, { itineraryRowKey } from '@/src/components/ItineraryRowItem';
import LoadingState from '@/src/components/LoadingState';
import SmallButton from '@/src/components/SmallButton';
import ScreenHeader from '@/src/components/ScreenHeader';
import { colors, spacing, gradients, radii } from '@/src/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/context/AuthProvider';
import { canRemoveStop, itineraryRows, timeline } from '@/src/domain/rules';
import type { AddStopRow } from '@/src/domain/rules';
import type { TripStop } from '@/src/types/trip';
import { useAsync } from '@/src/hooks/useAsync';
import { useTripMembersRealtime } from '@/src/hooks/useTripMembersRealtime';
import { useOpenSwipeRow } from '@/src/hooks/useOpenSwipeRow';
import { useTripStopsRealtime } from '@/src/hooks/useTripStopsRealtime';
import StopsMap from '@/src/components/StopsMap';
import SwipeToRemove from '@/src/components/SwipeToRemove';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { toTrip, toTripMember, toTripStop } from '@/src/lib/tripMapper';
import { getTrip, listTripMembers } from '@/src/services/tripService';
import { reportAndDescribe } from '@/src/services/errors';
import { listTripStops, removeTripStop } from '@/src/services/tripStopService';

const PlannerScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const tripId = Number(Array.isArray(id) ? id[0] : id);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Loaded together because the add button needs all three: stops and trip type decide what it
  // adds, and the role decides whether it shows
  const { data, loading, error, reload } = useAsync(
    async () => {
      if (!Number.isInteger(tripId)) return null;
      const [trip, stops, members] = await Promise.all([
        getTrip(tripId),
        listTripStops(tripId),
        listTripMembers(tripId),
      ]);
      return trip
        ? { trip: toTrip(trip), stops: stops.map(toTripStop), members: members.map(toTripMember) }
        : null;
    },
    [tripId],
    'PlannerScreen.load'
  );

  // A role change on another phone changes whether this member can add stops
  useTripMembersRealtime(tripId, reload);
  // So do stop changes, which also move the map's pins
  useTripStopsRealtime(tripId, reload);

  // Coming back from search or a stop's details may mean a new, changed or removed stop
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
    }, [reload])
  );

  const myRole = data?.members.find((member) => member.id === user?.id)?.role;
  const canEdit = myRole === 'owner' || myRole === 'editor';

  const rows = data
    ? itineraryRows(data.stops, data.trip.tripType, data.trip.startsAt, canEdit)
    : [];
  const segments = timeline(rows);

  const swipe = useOpenSwipeRow();
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // No confirm step: the button only shows after a deliberate swipe, and stop details still has
  // a Remove button that asks first
  const removeStop = async (stop: TripStop) => {
    setRemoveError(null);
    setRemovingId(stop.id);
    try {
      await removeTripStop(stop.id);
      reload();
    } catch (caught) {
      setRemoveError(reportAndDescribe(caught, { scope: 'PlannerScreen.removeStop' }));
      swipe.closeOpenRow();
    } finally {
      setRemovingId(null);
    }
  };

  // Each list action skips the tap that only closed a swiped-open row
  const openSearch = swipe.unlessClosing(({ stopType, atPosition }: AddStopRow) =>
    router.push({
      pathname: '/trips/[id]/addStop',
      params: { id: tripId, stopType, ...(atPosition === undefined ? {} : { atPosition }) },
    })
  );

  // Editors can change or remove the stop there, and everyone else sees its details
  const openStop = swipe.unlessClosing((stop: TripStop) =>
    router.push({
      pathname: '/trips/[id]/stopDetails',
      params: { id: tripId, stopId: stop.id },
    })
  );

  const openMap = swipe.unlessClosing(() => {
    haptics.action();
    router.push({ pathname: '/trips/[id]/map', params: { id: tripId } });
  });

  // Only an owner or editor can swipe, and only on a stop that can come off the trip
  const swipeToRemove = (stop: TripStop, card: React.ReactNode) =>
    canEdit && canRemoveStop(stop) ? (
      <SwipeToRemove
        removeLabel={`Remove ${stop.name}`}
        onRemove={() => removeStop(stop)}
        removing={removingId === stop.id}
        onOpen={(methods) => swipe.onRowOpen(stop.id, methods)}
        onClose={() => swipe.onRowClose(stop.id)}
        onTouchStart={() => swipe.onRowTouch(stop.id)}
        testID={`swipe-stop-${stop.id}`}
      >
        {card}
      </SwipeToRemove>
    ) : (
      card
    );

  return (
    // Any touch outside the open row closes it
    <View style={{ flex: 1 }} onTouchStart={swipe.onScreenTouch}>
      <View>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient
          pointerEvents="none"
          {...gradients.cardToBackground()}
          style={StyleSheet.absoluteFill}
        />
        <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <ScreenHeader
            title="Planner"
            onBack={() => router.back()}
            rightAction={
              <SmallButton
                icon={Settings}
                onPress={() => router.push(`/trips/${tripId}/tripSettings`)}
                accessibilityLabel="Trip settings"
              />
            }
          />
          {/* Measured with the header, so the list's top fade sits below the map, not over it */}
          {data && data.stops.length > 0 ? (
            <View style={styles.mapBox}>
              {/* The preview only shows the route; the full-screen map is where it can be moved */}
              <View pointerEvents="none" style={styles.mapPreview}>
                <StopsMap stops={data.stops} testID="planner-map" />
              </View>
              <Pressable
                onPress={openMap}
                accessibilityRole="button"
                accessibilityLabel="Open map"
                style={({ pressed }) => [StyleSheet.absoluteFill, pressFeedback.card(pressed)]}
              >
                <View style={styles.expandHint}>
                  <Maximize2 color={colors.text} size={18} />
                </View>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      {/* Keeps showing the stops during a reload instead of flashing the spinner */}
      {!data ? (
        loading ? (
          <LoadingState testID="planner-loading" />
        ) : (
          <EmptyState
            title={error ? "Couldn't load planner" : 'Trip not found'}
            subtitle={error ?? undefined}
          />
        )
      ) : (
        <FlatList
          data={rows}
          keyExtractor={itineraryRowKey}
          renderItem={({ item, index }) => (
            <ItineraryRowItem
              row={item}
              segment={segments[index]}
              onAdd={openSearch}
              onOpenStop={openStop}
              wrapStop={swipeToRemove}
              highlightKeyStops
            />
          )}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingLeft: spacing.xs,
            paddingBottom: insets.bottom + spacing.sm,
          }}
          // An editor's empty list still has the Set start button, so this can't be ListEmptyComponent
          ListHeaderComponent={
            <>
              <View style={styles.listSpacer} />
              <ErrorText message={error} onRetry={reload} />
              <ErrorText message={removeError} testID="planner-remove-error" />
              {data.stops.length === 0 ? (
                <EmptyState
                  title="No stops yet"
                  subtitle={
                    canEdit
                      ? 'Set a starting point to begin planning.'
                      : 'The owner or an editor can add stops.'
                  }
                />
              ) : null}
            </>
          }
        />
      )}

      <LinearGradient
        colors={[colors.background, 'transparent']}
        pointerEvents="none"
        style={[styles.headerFade, { top: headerHeight }]}
      />
    </View>
  );
};

export default PlannerScreen;

const styles = StyleSheet.create({
  headerFade: {
    position: 'absolute',
    height: spacing.md,
    left: 0,
    right: 0,
  },
  listSpacer: {
    height: spacing.sm,
  },
  // A fixed height keeps the list below it scrollable. The clip rounds the map's corners on Android
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
