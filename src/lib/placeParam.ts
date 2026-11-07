/**
 * @file placeParam.ts
 * @description Carries a picked place between screens as a route param
 */
import type { Place } from '@/src/types/trip';

export const toPlaceParam = (place: Place) => encodeURIComponent(JSON.stringify(place));

export const parsePlaceParam = (value: unknown): Place | null => {
  if (typeof value !== 'string') return null;

  try {
    const place = JSON.parse(value) as Partial<Place> | null;
    const isPlace =
      typeof place?.mapboxId === 'string' &&
      typeof place.name === 'string' &&
      typeof place.lat === 'number' &&
      typeof place.lng === 'number';
    return isPlace ? (place as Place) : null;
  } catch {
    return null;
  }
};
