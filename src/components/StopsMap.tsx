/**
 * @file StopsMap.tsx
 * @description A trip's stops on a map, numbered in the order the group reaches them. The map keeps
 * every stop in view, and moves when stops are added, moved or removed
 */
import { LineLayer, MarkerView, ShapeSource } from '@rnmapbox/maps';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import TripMap from '@/src/components/TripMap';
import type { CoveredEdges } from '@/src/components/TripMap';
import { haptics } from '@/src/constants/haptics';
import { colors, fontSize, fontWeight, radii } from '@/src/constants/theme';
import { isKeyStop } from '@/src/domain/rules';
import { sectionStopIds } from '@/src/domain/route';
import type { RouteSection, TripRoute } from '@/src/domain/route';
import type { Position } from '@/src/lib/mapCamera';
import { joinPolylines } from '@/src/lib/polyline';
import type { TripStop } from '@/src/types/trip';

const PIN_SIZE = 28;

type StopsMapProps = {
  stops: readonly TripStop[]; // in trip order, which sets each pin's number
  onOpenStop?: (stop: TripStop) => void; // pins can't be tapped without it
  route?: TripRoute | null; // the driving line between the stops, once it's in
  // One way of a round trip to show on its own: drawn bright over the dimmed route, with only its
  // stops pinned and the map fitted to it
  section?: RouteSection | null;
  recenterRequest?: number; // each new number flies the camera back to the fit
  coveredEdges?: CoveredEdges; // space along each edge the screen draws over, kept clear of pins
  fitMargin?: number; // room around the outermost stops; more zooms the map further out
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type StopMarkersProps = {
  stops: readonly TripStop[]; // in trip order, which sets each pin's number
  onOpenStop?: (stop: TripStop) => void; // pins can't be tapped without it
  // Pins only these stops, keeping each one's number in the whole trip. Every stop without it
  visibleIds?: ReadonlySet<number>;
};

// The numbered pins on their own, for a map that sets its own camera, like search's
export const StopMarkers = ({ stops, onOpenStop, visibleIds }: StopMarkersProps) =>
  stops.map((stop, index) => {
    if (visibleIds && !visibleIds.has(stop.id)) return null;
    // The start, destination and end are tinted, as they are in the itinerary list
    const keyStop = isKeyStop(stop);
    return (
      <MarkerView
        key={stop.id}
        // Mapbox reads coordinates longitude first
        coordinate={[stop.lng, stop.lat]}
        // Two stops close together would otherwise hide one of the pins
        allowOverlap
        testID={`map-pin-${stop.id}`}
      >
        <Pressable
          disabled={!onOpenStop}
          onPress={() => {
            haptics.action();
            onOpenStop?.(stop);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Stop ${index + 1}, ${stop.name}`}
          style={[styles.pin, keyStop && styles.keyPin]}
        >
          <Text style={[styles.number, keyStop && styles.keyNumber]}>{index + 1}</Text>
        </Pressable>
      </MarkerView>
    );
  });

// The road the group drives, under the pins. Decoding a long route takes a moment, so it only
// happens when the route changes
// Dimmed, it stays in view as the whole trip while a part of it is drawn brighter on top
export const RouteLine = ({ route, dimmed = false }: { route: TripRoute; dimmed?: boolean }) => {
  const shape = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: joinPolylines(route.geometry) },
    }),
    [route.geometry]
  );

  return (
    <ShapeSource id="trip-route" shape={shape}>
      <LineLayer
        id="trip-route-line"
        style={dimmed ? { ...routeLineStyle, lineOpacity: 0.3 } : routeLineStyle}
      />
    </ShapeSource>
  );
};

// One way of a round trip, bright over the dimmed full route
export const RouteSectionLine = ({ line }: { line: readonly Position[] }) => {
  const shape = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [...line] },
    }),
    [line]
  );

  return (
    <ShapeSource id="route-section" shape={shape} testID="route-section">
      <LineLayer id="route-section-line" style={sectionLineStyle} />
    </ShapeSource>
  );
};

const StopsMap = ({
  stops,
  onOpenStop,
  route,
  section,
  recenterRequest,
  coveredEdges,
  fitMargin,
  style,
  testID,
}: StopsMapProps) => {
  const sectionPlaces = useMemo(
    () => section?.line.map(([lng, lat]) => ({ lat, lng })) ?? null,
    [section]
  );
  const visibleIds = useMemo(
    () => (section ? sectionStopIds(stops, section) : undefined),
    [section, stops]
  );

  return (
    <TripMap
      fitTo={sectionPlaces ?? stops}
      coveredEdges={coveredEdges}
      fitMargin={fitMargin}
      recenterRequest={recenterRequest}
      style={style}
      testID={testID}
    >
      {route ? <RouteLine route={route} dimmed={!!section} /> : null}
      {section ? <RouteSectionLine line={section.line} /> : null}
      <StopMarkers stops={stops} onOpenStop={onOpenStop} visibleIds={visibleIds} />
    </TripMap>
  );
};

export default StopsMap;

const sectionLineStyle = {
  lineColor: colors.tint,
  lineWidth: 5,
  lineCap: 'round',
  lineJoin: 'round',
} as const;

const routeLineStyle = {
  lineColor: colors.tint,
  lineWidth: 4,
  lineOpacity: 0.85,
  lineCap: 'round',
  lineJoin: 'round',
} as const;

const styles = StyleSheet.create({
  pin: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.tint,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPin: {
    backgroundColor: colors.tint,
    borderColor: colors.textOnTint,
  },
  number: {
    color: colors.text,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
  },
  keyNumber: {
    color: colors.textOnTint,
  },
});
