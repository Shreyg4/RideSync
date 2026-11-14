/**
 * @file TripMap.tsx
 * @description The map every trip screen builds on. Pins and routes go in as children
 */
import { Camera, MapView } from '@rnmapbox/maps';
import type { CameraStop, MapState } from '@rnmapbox/maps';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { areaFromBounds, cameraFit } from '@/src/lib/mapCamera';
import type { CameraFit, MapArea } from '@/src/lib/mapCamera';
import { MAP_STYLES, useMapStyle } from '@/src/lib/mapStyle';
import type { Coordinates } from '@/src/types/trip';

const DEFAULT_ZOOM = 11;
// Room around the outermost places so their pins aren't cut off at the edge
const FIT_PADDING = 48;
const FIT_ANIMATION_MS = 600;

type TripMapProps = {
  initialCenter?: Coordinates; // where the map opens; the whole world shows without one
  initialZoom?: number; // also the zoom for fitTo when it holds a single place
  fitTo?: readonly Coordinates[]; // keeps all of these in view, moving when they change
  // Space along each edge that something drawn over the map covers, like a search bar, so fitTo
  // keeps its places clear of it. Added to the usual margin
  coveredEdges?: CoveredEdges;
  fitMargin?: number; // room left around fitTo's outermost places; more zooms the map further out
  // Called with the area on screen once the map settles after the user drags or zooms it. The
  // camera moving by itself, like for fitTo, doesn't count
  onUserMoved?: (area: MapArea) => void;
  // Each new number flies the camera back to fitTo, even after the user panned away from it
  recenterRequest?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
};

export type CoveredEdges = { top?: number; right?: number; bottom?: number; left?: number };

const cameraStopFor = (
  fit: CameraFit,
  zoom: number,
  fitMargin: number,
  { top = 0, right = 0, bottom = 0, left = 0 }: CoveredEdges
): CameraStop => {
  // A single place is centered in the uncovered area, so it gets only the covered space
  const margin = fit.kind === 'center' ? 0 : fitMargin;
  const padding = {
    paddingTop: margin + top,
    paddingRight: margin + right,
    paddingBottom: margin + bottom,
    paddingLeft: margin + left,
  };
  return fit.kind === 'center'
    ? { centerCoordinate: fit.center, zoomLevel: zoom, padding }
    : { bounds: { ne: fit.ne, sw: fit.sw }, padding };
};

const TripMap = ({
  initialCenter,
  initialZoom = DEFAULT_ZOOM,
  fitTo,
  coveredEdges,
  fitMargin = FIT_PADDING,
  onUserMoved,
  recenterRequest = 0,
  style,
  testID,
  children,
}: TripMapProps) => {
  const mapStyle = useMapStyle();

  // Android clears the gesture flag before the map goes idle, so a drag is noted while it happens
  const userMoved = useRef(false);

  const noteGesture = (state: MapState) => {
    if (state.gestures.isGestureActive) userMoved.current = true;
  };

  const reportUserMove = (state: MapState) => {
    if (!userMoved.current) return;
    userMoved.current = false;
    onUserMoved?.(areaFromBounds(state.properties.bounds, state.properties.center));
  };

  // A reload hands in a new array holding the same places. Keying on the values leaves the camera
  // where the user panned it, and only moves it when a place is added, moved or removed
  const fitKey = fitTo ? JSON.stringify(cameraFit(fitTo)) : 'null';
  const { top, right, bottom, left } = coveredEdges ?? {};
  const fitted = useMemo(() => {
    const fit = JSON.parse(fitKey) as CameraFit | null;
    return fit ? cameraStopFor(fit, initialZoom, fitMargin, { top, right, bottom, left }) : null;
  }, [fitKey, initialZoom, fitMargin, top, right, bottom, left]);

  // Opening on the first fit stops the camera flying in from the whole world
  const [openingFit] = useState(fitted);

  // The camera only moves itself when fitTo changes. After a pan, fitTo is still the same, so going
  // back to it has to be asked for directly
  const camera = useRef<Camera>(null);
  const latestFit = useRef(fitted);
  latestFit.current = fitted;
  useEffect(() => {
    if (recenterRequest === 0 || !latestFit.current) return;
    camera.current?.setCamera({
      ...latestFit.current,
      animationMode: 'easeTo',
      animationDuration: FIT_ANIMATION_MS,
    });
  }, [recenterRequest]);

  return (
    <MapView
      style={[styles.map, style]}
      styleURL={MAP_STYLES[mapStyle].url}
      scaleBarEnabled={false}
      // Camera events cross to JavaScript many times a second, so only a map that uses them gets them
      onCameraChanged={onUserMoved ? noteGesture : undefined}
      onMapIdle={onUserMoved ? reportUserMove : undefined}
      testID={testID}
    >
      {fitted ? (
        <Camera
          ref={camera}
          defaultSettings={openingFit ?? undefined}
          {...fitted}
          animationMode="easeTo"
          animationDuration={FIT_ANIMATION_MS}
        />
      ) : initialCenter ? (
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
};

export default TripMap;

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
