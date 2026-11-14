/**
 * @file RouteSearchLayers.tsx
 * @description What a map search along the route draws: the chosen way of the trip over the dimmed
 * full route, the point the search looks around, and the circle it covers
 */
import { FillLayer, LineLayer, MarkerView, ShapeSource } from '@rnmapbox/maps';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { RouteSectionLine } from '@/src/components/StopsMap';
import { colors, radii } from '@/src/constants/theme';
import { circlePolygon } from '@/src/lib/geo';
import type { Position } from '@/src/lib/mapCamera';
import type { Coordinates } from '@/src/types/trip';

const POINT_SIZE = 18;

type RouteSearchLayersProps = {
  sectionLine: readonly Position[]; // the way of the trip being searched
  point: Coordinates;
  radiusMeters: number;
};

const RouteSearchLayers = ({ sectionLine, point, radiusMeters }: RouteSearchLayersProps) => {
  const circle = useMemo<GeoJSON.Feature<GeoJSON.Polygon>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [circlePolygon(point, radiusMeters)] },
    }),
    [point, radiusMeters]
  );

  return (
    <>
      <RouteSectionLine line={sectionLine} />
      <ShapeSource id="search-radius" shape={circle} testID="search-radius">
        <FillLayer id="search-radius-fill" style={radiusFillStyle} />
        <LineLayer id="search-radius-outline" style={radiusOutlineStyle} />
      </ShapeSource>
      <MarkerView
        // Mapbox reads coordinates longitude first
        coordinate={[point.lng, point.lat]}
        allowOverlap
        testID="search-point"
      >
        <View style={styles.point} accessibilityElementsHidden />
      </MarkerView>
    </>
  );
};

export default RouteSearchLayers;

const radiusFillStyle = {
  fillColor: colors.tint,
  fillOpacity: 0.12,
} as const;

const radiusOutlineStyle = {
  lineColor: colors.tint,
  lineWidth: 1.5,
  lineOpacity: 0.6,
} as const;

const styles = StyleSheet.create({
  point: {
    width: POINT_SIZE,
    height: POINT_SIZE,
    borderRadius: radii.pill,
    borderWidth: 3,
    borderColor: colors.text,
    backgroundColor: colors.tint,
  },
});
