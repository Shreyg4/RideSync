import { describe, expect, it } from '@jest/globals';
import type { Position } from '../mapCamera';
import {
  circlePolygon,
  cumulativeDistances,
  distanceMeters,
  positionAtDistance,
  sliceLine,
} from '../geo';

// A degree of longitude along the equator
const D = distanceMeters([0, 0], [1, 0]);

const expectPosition = (actual: Position, expected: Position) => {
  expect(actual[0]).toBeCloseTo(expected[0], 6);
  expect(actual[1]).toBeCloseTo(expected[1], 6);
};

describe('distanceMeters', () => {
  it('measures a degree along the equator as about 111 km', () => {
    expect(D).toBeCloseTo(111_195, -1);
  });

  it('measures a degree of longitude as shorter further from the equator', () => {
    expect(distanceMeters([0, 60], [1, 60])).toBeCloseTo(D / 2, -2);
  });

  it('is zero between a point and itself', () => {
    expect(distanceMeters([-122.3, 47.6], [-122.3, 47.6])).toBe(0);
  });
});

describe('cumulativeDistances', () => {
  it('gives how far along the line each point is', () => {
    const distances = cumulativeDistances([
      [0, 0],
      [1, 0],
      [3, 0],
    ]);

    expect(distances[0]).toBe(0);
    expect(distances[1]).toBeCloseTo(D, 3);
    expect(distances[2]).toBeCloseTo(3 * D, 3);
  });

  it('gives nothing for an empty line', () => {
    expect(cumulativeDistances([])).toEqual([]);
  });
});

describe('positionAtDistance', () => {
  const line: Position[] = [
    [0, 0],
    [1, 0],
    [3, 0],
  ];
  const distances = cumulativeDistances(line);

  it('finds a point between two of the line’s points', () => {
    expectPosition(positionAtDistance(line, distances, 2 * D), [2, 0]);
    expectPosition(positionAtDistance(line, distances, 0.25 * D), [0.25, 0]);
  });

  it('lands exactly on one of the line’s points', () => {
    expectPosition(positionAtDistance(line, distances, D), [1, 0]);
  });

  it('keeps distances before the start or past the end on the line', () => {
    expect(positionAtDistance(line, distances, -5)).toEqual([0, 0]);
    expect(positionAtDistance(line, distances, 10 * D)).toEqual([3, 0]);
  });

  it('copes with two points at the same spot', () => {
    const repeated: Position[] = [
      [0, 0],
      [1, 0],
      [1, 0],
      [2, 0],
    ];

    expectPosition(positionAtDistance(repeated, cumulativeDistances(repeated), 1.5 * D), [1.5, 0]);
  });

  it('refuses an empty line', () => {
    expect(() => positionAtDistance([], [], 0)).toThrow();
  });
});

describe('sliceLine', () => {
  const line: Position[] = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ];
  const distances = cumulativeDistances(line);

  it('keeps the points between the two distances, with exact ends', () => {
    const slice = sliceLine(line, distances, 0.5 * D, 2.5 * D);

    expect(slice).toHaveLength(4);
    expectPosition(slice[0], [0.5, 0]);
    expectPosition(slice[1], [1, 0]);
    expectPosition(slice[2], [2, 0]);
    expectPosition(slice[3], [2.5, 0]);
  });

  it('keeps the whole line from its start to its end', () => {
    expect(sliceLine(line, distances, 0, distances[3])).toEqual(line);
  });
});

describe('circlePolygon', () => {
  it('closes the ring, so the map draws it as a shape', () => {
    const ring = circlePolygon({ lat: 47.6, lng: -122.3 }, 16_000);

    expect(ring).toHaveLength(65);
    expect(ring.at(-1)).toEqual(ring[0]);
  });

  it.each([0, 47.6, -33.9, 64.8])(
    'keeps every point the radius away from the center at latitude %d',
    (lat) => {
      const center = { lat, lng: -120 };
      for (const position of circlePolygon(center, 16_000)) {
        expect(distanceMeters([center.lng, center.lat], position) / 16_000).toBeCloseTo(1, 2);
      }
    }
  );
});
