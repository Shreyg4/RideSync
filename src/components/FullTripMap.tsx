/**
 * @file FullTripMap.tsx
 * @description A trip's stops and route on a full-screen map, with a back button, a recenter button
 * and, for a round trip, the choice of showing the whole drive, the way there or the way home
 */
import { router, Stack } from 'expo-router';
import { ChevronLeft, Locate } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '@/src/components/BottomSheet';
import EmptyState from '@/src/components/EmptyState';
import LoadingState from '@/src/components/LoadingState';
import RouteDirectionChips from '@/src/components/RouteDirectionChips';
import SmallButton from '@/src/components/SmallButton';
import StopsMap from '@/src/components/StopsMap';
import { colors, spacing } from '@/src/constants/theme';
import { routeSections, sectionFor } from '@/src/domain/route';
import type { RouteDirection, TripRoute } from '@/src/domain/route';
import { joinPolylines } from '@/src/lib/polyline';
import type { TripStop, TripType } from '@/src/types/trip';

const BACK_BUTTON_SIZE = 48;
// More room around the stops than a small map gets, since the route can bulge out past them and a
// full screen has space to show where the trip sits
const FIT_MARGIN = 80;

type FullTripMapProps = {
  stops: readonly TripStop[] | undefined; // in trip order; undefined while loading
  tripType: TripType | undefined; // says whether the route drives back to the start
  route: TripRoute | null;
  loading: boolean;
  error: string | null;
  onOpenStop?: (stop: TripStop) => void; // pins can't be tapped without it
  testID?: string;
};

const FullTripMap = ({
  stops,
  tripType,
  route,
  loading,
  error,
  onOpenStop,
  testID = 'trip-map',
}: FullTripMapProps) => {
  const insets = useSafeAreaInsets();

  // A round trip's way there and way back, which the sheet at the bottom can show one at a time
  const sections = useMemo(
    () =>
      route && stops && tripType
        ? routeSections(stops, tripType, route.legs, joinPolylines(route.geometry))
        : null,
    [route, stops, tripType]
  );
  // Opens on the full trip, every stop and the whole route as they are. Picking a way shows only it
  const [direction, setDirection] = useState<RouteDirection>('full');
  const section = sections && direction !== 'full' ? sectionFor(sections, direction) : null;
  // Only a round trip has ways to choose between
  const showSheet = !!sections?.return;
  const [sheetHeight, setSheetHeight] = useState(0);

  const [recenterRequest, setRecenterRequest] = useState(0);

  // Keeps the stops clear of the notch or Dynamic Island and the back button at the top, and the
  // home indicator or the sheet at the bottom, all of which the full-screen map runs under
  const bottomCovered = showSheet ? sheetHeight : insets.bottom;
  const coveredEdges = {
    top: insets.top + spacing.sm + BACK_BUTTON_SIZE,
    right: insets.right,
    bottom: bottomCovered,
    left: insets.left,
  };

  return (
    <View style={styles.screen}>
      {/* The map fills the screen, so a swipe from its edge has to pan the map, not leave */}
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      {/* Keeps showing the pins during a reload instead of flashing the spinner */}
      {stops ? (
        <StopsMap
          stops={stops}
          route={route}
          section={section}
          recenterRequest={recenterRequest}
          onOpenStop={onOpenStop}
          coveredEdges={coveredEdges}
          fitMargin={FIT_MARGIN}
          testID={testID}
        />
      ) : loading ? (
        <LoadingState testID={`${testID}-loading`} />
      ) : (
        <EmptyState title="Couldn't load the map" subtitle={error ?? undefined} />
      )}

      <SmallButton
        icon={ChevronLeft}
        onPress={() => router.back()}
        accessibilityLabel="Go back"
        color={colors.text}
        backgroundColor="rgba(0, 0, 0, 0.6)"
        diameter={BACK_BUTTON_SIZE}
        style={[styles.back, { top: insets.top + spacing.sm }]}
      />

      {stops && stops.length > 0 ? (
        <SmallButton
          icon={Locate}
          // Back to the whole trip, or to the way picked below, after panning away
          onPress={() => setRecenterRequest((count) => count + 1)}
          accessibilityLabel="Recenter map"
          backgroundColor={colors.background}
          style={[styles.recenter, { bottom: bottomCovered + spacing.sm }]}
          testID="recenter-map"
        />
      ) : null}

      {showSheet ? (
        <View style={styles.sheetArea}>
          <BottomSheet
            bottomInset={insets.bottom}
            onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
            testID="map-direction-sheet"
          >
            <RouteDirectionChips value={direction} onChange={setDirection} />
          </BottomSheet>
        </View>
      ) : null}
    </View>
  );
};

export default FullTripMap;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  back: {
    position: 'absolute',
    left: spacing.md,
  },
  recenter: {
    position: 'absolute',
    right: spacing.md,
  },
  sheetArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
