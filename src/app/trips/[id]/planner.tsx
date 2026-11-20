import { Pressable, StyleSheet, Text, View } from 'react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReorderableList from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';
import { Maximize2, Settings } from 'lucide-react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DragHandle from '@/src/components/DragHandle';
import EmptyState from '@/src/components/EmptyState';
import ErrorText from '@/src/components/ErrorText';
import ItineraryRowItem, { itineraryRowKey } from '@/src/components/ItineraryRowItem';
import LoadingState from '@/src/components/LoadingState';
import SmallButton from '@/src/components/SmallButton';
import ScreenHeader from '@/src/components/ScreenHeader';
import { colors, fontSize, spacing, gradients, radii } from '@/src/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/context/AuthProvider';
import {
  canMoveStop,
  canRemoveStop,
  itineraryRows,
  orderStops,
  reorderedStopIds,
  timeline,
} from '@/src/domain/rules';
import type { AddStopRow } from '@/src/domain/rules';
import { routeTotalsLabel, tripTimings } from '@/src/domain/route';
import type { TripStop } from '@/src/types/trip';
import { useAsync } from '@/src/hooks/useAsync';
import { useTripMembersRealtime } from '@/src/hooks/useTripMembersRealtime';
import { useOpenSwipeRow } from '@/src/hooks/useOpenSwipeRow';
import { useTripStopsRealtime } from '@/src/hooks/useTripStopsRealtime';
import { useTripRoute } from '@/src/hooks/useTripRoute';
import StopsMap from '@/src/components/StopsMap';
import SwipeToRemove from '@/src/components/SwipeToRemove';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { toTrip, toTripMember, toTripStop } from '@/src/lib/tripMapper';
import { getTrip, listTripMembers } from '@/src/services/tripService';
import { reportAndDescribe } from '@/src/services/errors';
import { listTripStops, removeTripStop, reorderTripStops } from '@/src/services/tripStopService';

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

  // A change from another phone would swap the rows under a stop being dragged, so it waits for
  // the drop
  const dragging = useRef(false);
  const reloadAfterDrag = useRef(false);
  const reloadUnlessDragging = useCallback(() => {
    if (dragging.current) reloadAfterDrag.current = true;
    else reload();
  }, [reload]);
  const setDragging = useCallback(
    (value: boolean) => {
      dragging.current = value;
      if (!value && reloadAfterDrag.current) {
        reloadAfterDrag.current = false;
        reload();
      }
    },
    [reload]
  );

  // A role change on another phone changes whether this member can add stops
  useTripMembersRealtime(tripId, reloadUnlessDragging);
  // So do stop changes, which also move the map's pins
  useTripStopsRealtime(tripId, reloadUnlessDragging);

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

  // A dragged stop shows in its new place at once. The order is kept until the save succeeds and
  // the stops load again, and dropped if the save fails, which puts the stop back
  const [pendingOrder, setPendingOrder] = useState<{ ids: number[]; saved: boolean } | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  // The list only puts its rows back in place when it renders again, so a refused drop counts
  // here to make it render
  const [refusedDrops, setRefusedDrops] = useState(0);
  useEffect(() => {
    setPendingOrder((pending) => (pending?.saved ? null : pending));
  }, [data]);
  const saving = pendingOrder !== null && !pendingOrder.saved;
  const stops = data ? orderStops(data.stops, pendingOrder?.ids) : undefined;

  const rows =
    data && stops ? itineraryRows(stops, data.trip.tripType, data.trip.startsAt, canEdit) : [];
  const segments = timeline(rows);

  // Follows the stops: a change from any phone reloads them, and new places fetch a new route
  const route = useTripRoute(tripId, stops, data?.trip.tripType);
  const timings =
    data && stops && route.route
      ? tripTimings(stops, data.trip.tripType, data.trip.startsAt, route.route.legs)
      : null;

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

  const moveStop = async (from: number, to: number) => {
    const ids = reorderedStopIds(rows, from, to);
    // A drop where the stop can't go changes nothing, and the stop goes back where it came from
    if (!ids) {
      haptics.warning();
      setRefusedDrops((count) => count + 1);
      return;
    }

    setReorderError(null);
    setPendingOrder({ ids, saved: false });
    try {
      await reorderTripStops(tripId, ids);
      setPendingOrder({ ids, saved: true });
      reload();
    } catch (caught) {
      setPendingOrder(null);
      setReorderError(reportAndDescribe(caught, { scope: 'PlannerScreen.moveStop' }));
      // The save is refused when the stops changed on another phone, so show what's there now
      reload();
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

  // Only an owner or editor can drag, and only stops between the trip's fixed points
  const dragHandle = (stop: TripStop) =>
    canEdit && canMoveStop(stop) ? (
      <DragHandle label={`Move ${stop.name}`} disabled={saving} testID={`drag-stop-${stop.id}`} />
    ) : null;

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
          {stops && stops.length > 0 ? (
            <View style={styles.mapBox}>
              {/* The preview only shows the route; the full-screen map is where it can be moved */}
              <View pointerEvents="none" style={styles.mapPreview}>
                <StopsMap stops={stops} route={route.route} testID="planner-map" />
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
        <ReorderableList
          data={rows}
          keyExtractor={itineraryRowKey}
          extraData={refusedDrops}
          onReorder={({ from, to }) => moveStop(from, to)}
          onDragStart={() => {
            'worklet';
            scheduleOnRN(setDragging, true);
          }}
          onDragEnd={() => {
            'worklet';
            scheduleOnRN(setDragging, false);
          }}
          testID="planner-list"
          renderItem={({ item, index }) => (
            <ItineraryRowItem
              row={item}
              segment={segments[index]}
              timings={timings}
              onAdd={openSearch}
              onOpenStop={openStop}
              wrapStop={swipeToRemove}
              stopAccessory={dragHandle}
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
              <ErrorText message={reorderError} testID="planner-reorder-error" />
              <ErrorText message={route.error} onRetry={route.retry} testID="planner-route-error" />
              {timings ? (
                <Text style={styles.totals} testID="planner-route-totals">
                  {routeTotalsLabel(timings)}
                </Text>
              ) : null}
              {stops?.length === 0 ? (
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
  totals: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
    textAlign: 'center',
    marginBottom: spacing.xs,
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
