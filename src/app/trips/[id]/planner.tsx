import { FlatList, StyleSheet, View } from 'react-native';
import React, { useCallback, useRef, useState } from 'react';
import { Settings, Plus } from 'lucide-react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmptyState from '@/src/components/EmptyState';
import ErrorText from '@/src/components/ErrorText';
import LargeButton from '@/src/components/LargeButton';
import LoadingState from '@/src/components/LoadingState';
import SmallButton from '@/src/components/SmallButton';
import ScreenHeader from '@/src/components/ScreenHeader';
import { colors, spacing, gradients } from '@/src/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import StopListItem from '@/src/components/StopListItem';
import { useAuth } from '@/src/context/AuthProvider';
import { addStopLabel, nextStopType } from '@/src/domain/rules';
import { useAsync } from '@/src/hooks/useAsync';
import { useTripMembersRealtime } from '@/src/hooks/useTripMembersRealtime';
import { toTrip, toTripMember, toTripStop } from '@/src/lib/tripMapper';
import { getTrip, listTripMembers } from '@/src/services/tripService';
import { listTripStops } from '@/src/services/tripStopService';

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

  // Coming back from the search screen may mean a new stop
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

  return (
    <View style={{ flex: 1 }}>
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
          data={data.stops}
          keyExtractor={(stop) => stop.id.toString()}
          renderItem={({ item }) => <StopListItem stop={item} testID={`stop-${item.id}`} />}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.sm }}
          ListHeaderComponent={
            <>
              <View style={styles.listSpacer} />
              <ErrorText message={error} onRetry={reload} />
            </>
          }
          ListEmptyComponent={
            <EmptyState
              title="No stops yet"
              subtitle={
                canEdit
                  ? 'Set a starting point to begin planning.'
                  : 'The owner or an editor can add stops.'
              }
            />
          }
          ListFooterComponent={
            canEdit ? (
              <LargeButton
                icon={Plus}
                label={addStopLabel(nextStopType(data.stops, data.trip.tripType))}
                variant="dashed"
                onPress={() => router.push(`/trips/${tripId}/addStop`)}
              />
            ) : null
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
});
