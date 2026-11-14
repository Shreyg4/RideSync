/**
 * @file geo.ts
 * @description Measuring along a line on the map: how long it is, where a given distance along it
 * lands, and the piece of it between two distances
 */
import type { Position } from './mapCamera';

const EARTH_RADIUS_M = 6_371_008.8;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// Straight-line distance over the earth's surface, in meters
export const distanceMeters = ([lng1, lat1]: Position, [lng2, lat2]: Position) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
};

// How far along the line each of its points is, starting at 0. The last value is its length
export const cumulativeDistances = (line: readonly Position[]) => {
  const distances: number[] = [];
  line.forEach((position, index) => {
    distances.push(
      index === 0 ? 0 : distances[index - 1] + distanceMeters(line[index - 1], position)
    );
  });
  return distances;
};

// The last point at or before the distance, so the answer lies between it and the next point
const segmentAt = (distances: readonly number[], distance: number) => {
  let low = 0;
  let high = distances.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (distances[middle] <= distance) low = middle;
    else high = middle - 1;
  }
  return low;
};

// The point the given distance along the line, between its points where needed. Distances before
// the start or past the end give the first or last point
export const positionAtDistance = (
  line: readonly Position[],
  distances: readonly number[],
  distance: number
): Position => {
  if (line.length === 0) throw new Error('An empty line has no positions');
  if (distance <= 0) return line[0];
  if (distance >= distances[distances.length - 1]) return line[line.length - 1];

  const index = segmentAt(distances, distance);
  const next = Math.min(index + 1, line.length - 1);
  const span = distances[next] - distances[index];
  const fraction = span > 0 ? (distance - distances[index]) / span : 0;
  const [lng1, lat1] = line[index];
  const [lng2, lat2] = line[next];
  return [lng1 + (lng2 - lng1) * fraction, lat1 + (lat2 - lat1) * fraction];
};

// The part of the line between two distances along it, with exact points at both ends
export const sliceLine = (
  line: readonly Position[],
  distances: readonly number[],
  from: number,
  to: number
): Position[] => {
  if (line.length === 0) return [];
  const inside = line.filter((_, index) => distances[index] > from && distances[index] < to);
  return [
    positionAtDistance(line, distances, from),
    ...inside,
    positionAtDistance(line, distances, to),
  ];
};

// A circle on the map as a closed ring of points, for drawing a search radius. Flat-earth offsets
// are close enough at the tens of miles a search covers
export const circlePolygon = (
  { lat, lng }: { lat: number; lng: number },
  radiusMeters: number,
  sides = 64
): Position[] => {
  const latSpan = (radiusMeters / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngSpan = latSpan / Math.max(Math.cos(toRadians(lat)), 0.01);
  const ring: Position[] = Array.from({ length: sides }, (_, index) => {
    const angle = (2 * Math.PI * index) / sides;
    return [lng + lngSpan * Math.sin(angle), lat + latSpan * Math.cos(angle)];
  });
  return [...ring, ring[0]];
};

export const METERS_PER_MILE = 1609.344;
