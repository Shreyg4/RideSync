/**
 * @file mapCamera.ts
 * @description Works out where a map's camera should point so every given place is in view
 */
import type { Coordinates } from '@/src/types/trip';

// Mapbox positions are [longitude, latitude]
export type Position = [lng: number, lat: number];

export type CameraFit =
  { kind: 'center'; center: Position } | { kind: 'bounds'; ne: Position; sw: Position };

// One place, or several at the same spot, has no area to fit, so the camera centers on it instead
// of zooming in as far as the map allows
export const cameraFit = (places: readonly Coordinates[]): CameraFit | null => {
  if (places.length === 0) return null;

  const lats = places.map((place) => place.lat);
  const lngs = places.map((place) => place.lng);
  const north = Math.max(...lats);
  const south = Math.min(...lats);
  const east = Math.max(...lngs);
  const west = Math.min(...lngs);

  if (north === south && east === west) return { kind: 'center', center: [east, north] };
  return { kind: 'bounds', ne: [east, north], sw: [west, south] };
};

// A part of the map, in the order Mapbox's bbox parameter takes it
export type BBox = [west: number, south: number, east: number, north: number];

// An area to search, and the point inside it that results are ranked by distance from
export type MapArea = { bbox: BBox; center: Coordinates };

const KM_PER_DEGREE = 111.32;

// A box reaching about radiusKm from the center each way. A degree of longitude covers less ground
// the further it is from the equator, so the box takes more of them there
export const areaAround = (center: Coordinates, radiusKm: number): MapArea => {
  const latSpan = radiusKm / KM_PER_DEGREE;
  const lngSpan =
    radiusKm / (KM_PER_DEGREE * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01));
  return {
    bbox: [
      Math.max(center.lng - lngSpan, -180),
      Math.max(center.lat - latSpan, -90),
      Math.min(center.lng + lngSpan, 180),
      Math.min(center.lat + latSpan, 90),
    ],
    center,
  };
};

// What the map reports is on screen, as an area to search. Mapbox gives its corners as northeast
// and southwest, longitude first
export const areaFromBounds = (
  bounds: { ne: readonly number[]; sw: readonly number[] },
  center: readonly number[]
): MapArea => ({
  bbox: [bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]],
  center: { lng: center[0], lat: center[1] },
});
