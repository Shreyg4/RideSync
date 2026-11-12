import { describe, expect, it } from '@jest/globals';
import { decodePolyline, joinPolylines } from '../polyline';

// The worked example from Google's description of the format, at five decimal places
const EXAMPLE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

describe('decodePolyline', () => {
  it('decodes the format’s worked example, longitude first', () => {
    expect(decodePolyline(EXAMPLE, 5)).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });

  it('reads six decimal places by default, the precision the app asks Mapbox for', () => {
    const [first] = decodePolyline(EXAMPLE);

    expect(first[0]).toBeCloseTo(-12.02, 10);
    expect(first[1]).toBeCloseTo(3.85, 10);
  });

  it('decodes an empty line to no points', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('joinPolylines', () => {
  it('keeps the point two parts share only once', () => {
    // Each part is the example: it ends where the next one starts
    const joined = joinPolylines([EXAMPLE, EXAMPLE], 5);

    expect(joined).toHaveLength(5);
    expect(joined[3]).toEqual([-120.95, 40.7]);
  });

  it('is the line itself when there is one part', () => {
    expect(joinPolylines([EXAMPLE], 5)).toEqual(decodePolyline(EXAMPLE, 5));
  });
});
