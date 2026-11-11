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
