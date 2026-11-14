import { describe, expect, it } from '@jest/globals';
import { encodePolyline } from '@/src/test/route';
import { decodePolyline } from '../polyline';

// The test helper has to agree with the app's decoder, or route fixtures would be wrong
describe('encodePolyline (test helper)', () => {
  it('encodes the format’s worked example', () => {
    const example: [number, number][] = [
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ];

    expect(encodePolyline(example, 5)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });

  it('round-trips through the app’s decoder', () => {
    const line: [number, number][] = [
      [-122.349284, 47.620506],
      [-120.655849, 47.598518],
      [-120.324, 47.430802],
    ];

    expect(decodePolyline(encodePolyline(line))).toEqual(line);
  });
});
