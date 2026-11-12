/**
 * @file polyline.ts
 * @description Decodes the encoded polyline format Mapbox Directions sends a route line in. Each
 * point is a pair of differences from the point before, written five bits to a character
 */
import type { Position } from './mapCamera';

// Mapbox reads positions longitude first, so they come out that way
export const decodePolyline = (encoded: string, precision = 6): Position[] => {
  const factor = 10 ** precision;
  const positions: Position[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const nextValue = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    // The lowest bit says whether the value is negative
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += nextValue();
    lng += nextValue();
    positions.push([lng / factor, lat / factor]);
  }
  return positions;
};

// The parts of a route fetched in more than one request, as one line. Each part starts where the
// one before ended, so that shared point is only kept once
export const joinPolylines = (parts: readonly string[], precision = 6): Position[] =>
  parts.flatMap((part, index) => {
    const positions = decodePolyline(part, precision);
    return index === 0 ? positions : positions.slice(1);
  });
