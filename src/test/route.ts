/**
 * @file route.ts
 * @description Saved routes for tests, made from a trip's stop rows so their key matches the stops
 * and their line runs straight from stop to stop
 */
import { routeKey, routePoints } from '@/src/domain/route';
import { distanceMeters } from '@/src/lib/geo';
import { toTripStop } from '@/src/lib/tripMapper';
import type { TripStopRow } from '@/src/services/tripStopService';
import type { TripType } from '@/src/types/trip';

// The reverse of decodePolyline, so a test can hand the app a line it chose
export const encodePolyline = (positions: readonly [number, number][], precision = 6) => {
  const factor = 10 ** precision;
  let lastLat = 0;
  let lastLng = 0;
  const encodeValue = (value: number) => {
    let shifted = value < 0 ? ~(value << 1) : value << 1;
    let out = '';
    while (shifted >= 0x20) {
      out += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63);
      shifted >>= 5;
    }
    return out + String.fromCharCode(shifted + 63);
  };
  return positions
    .map(([lng, lat]) => {
      const latE = Math.round(lat * factor);
      const lngE = Math.round(lng * factor);
      const chunk = encodeValue(latE - lastLat) + encodeValue(lngE - lastLng);
      lastLat = latE;
      lastLng = lngE;
      return chunk;
    })
    .join('');
};

// A trip_routes row for these stops, with every drive taking legHours
export const savedRouteRow = (stops: TripStopRow[], tripType: TripType, legHours = 1) => {
  const points = routePoints(stops.map(toTripStop), tripType);
  const line = points.map(({ lat, lng }): [number, number] => [lng, lat]);
  return {
    route_key: routeKey(points),
    legs: line.slice(1).map((position, index) => ({
      duration: legHours * 3600,
      distance: distanceMeters(line[index], position),
    })),
    geometry: [encodePolyline(line)],
  };
};
