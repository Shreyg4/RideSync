/**
 * @file TripMap.tsx
 * @description The map every trip screen builds on. Pins and routes go in as children
 */
import { Camera, MapView, StyleURL } from '@rnmapbox/maps';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Coordinates } from '@/src/types/trip';

const DEFAULT_ZOOM = 11;

type TripMapProps = {
  initialCenter?: Coordinates; // where the map opens; the whole world shows without one
  initialZoom?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
};

const TripMap = ({
  initialCenter,
  initialZoom = DEFAULT_ZOOM,
  style,
  testID,
  children,
}: TripMapProps) => (
  <MapView
    style={[styles.map, style]}
    styleURL={StyleURL.Dark}
    scaleBarEnabled={false}
    testID={testID}
  >
    {initialCenter ? (
      <Camera
        defaultSettings={{
          // Mapbox reads coordinates longitude first
          centerCoordinate: [initialCenter.lng, initialCenter.lat],
          zoomLevel: initialZoom,
        }}
      />
    ) : null}
    {children}
  </MapView>
);

export default TripMap;

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
