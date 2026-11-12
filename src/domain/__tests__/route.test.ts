import { describe, expect, it } from '@jest/globals';
import { formatTime, formatWeekday } from '@/src/lib/dateTime';
import type { TripStop } from '@/src/types/trip';
import {
  formatDistance,
  formatDuration,
  MAX_ROUTE_POINTS,
  routeChunks,
  routeKey,
  routePoints,
  routeTotalsLabel,
  stopTimingLabel,
  tripTimings,
} from '../route';

const stop = (
  id: number,
  stopType: TripStop['stopType'],
  lat: number,
  lng: number,
  overrides: Partial<TripStop> = {}
): TripStop => ({
  id,
  tripId: 1,
  position: id - 1,
  name: `Stop ${id}`,
  address: null,
  lat,
  lng,
  mapboxId: null,
  stopType,
  stopCategory: 'other',
  notes: null,
  departsAt: null,
  isTurnaround: false,
  ...overrides,
});

const HOUR = 3600;
const leg = (hours: number, km = 100) => ({ duration: hours * HOUR, distance: km * 1000 });

// Local times, so the tests read the same in any time zone
const STARTS = new Date(2026, 8, 12, 9, 0);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);

describe('routePoints', () => {
  it('drives through a one-way trip’s stops in order', () => {
    const stops = [
      stop(1, 'start', 47.6, -122.3),
      stop(2, 'stop', 47.4, -120.3),
      stop(3, 'end', 46, -119),
    ];

    expect(routePoints(stops, 'one-way')).toEqual([
      { lat: 47.6, lng: -122.3 },
      { lat: 47.4, lng: -120.3 },
      { lat: 46, lng: -119 },
    ]);
  });

  it('drives a round trip back to its start', () => {
    const stops = [
      stop(1, 'start', 47.6, -122.3),
      stop(2, 'stop', 47.4, -120.3, { isTurnaround: true }),
    ];

    expect(routePoints(stops, 'round-trip')).toEqual([
      { lat: 47.6, lng: -122.3 },
      { lat: 47.4, lng: -120.3 },
      { lat: 47.6, lng: -122.3 },
    ]);
  });

  it('has no route with only one place', () => {
    expect(routePoints([stop(1, 'start', 47.6, -122.3)], 'one-way')).toEqual([]);
    expect(routePoints([stop(1, 'start', 47.6, -122.3)], 'round-trip')).toEqual([]);
    expect(routePoints([], 'one-way')).toEqual([]);
  });
});

describe('routeKey', () => {
  it('writes each point longitude first, the order Mapbox expects', () => {
    expect(
      routeKey([
        { lat: 47.6, lng: -122.3 },
        { lat: 46, lng: -119 },
      ])
    ).toBe('-122.300000,47.600000;-119.000000,46.000000');
  });

  it('gives the same key for the same places, however their numbers are written', () => {
    expect(routeKey([{ lat: 47.60000000001, lng: -122.3 }])).toBe(
      routeKey([{ lat: 47.6, lng: -122.3 }])
    );
  });

  it('changes when a place moves', () => {
    expect(routeKey([{ lat: 47.6, lng: -122.3 }])).not.toBe(
      routeKey([{ lat: 47.61, lng: -122.3 }])
    );
  });
});

describe('routeChunks', () => {
  const points = (count: number) => Array.from({ length: count }, (_, i) => i);

  it('sends up to 25 points in one request', () => {
    expect(routeChunks(points(2))).toEqual([[0, 1]]);
    expect(routeChunks(points(MAX_ROUTE_POINTS))).toEqual([points(MAX_ROUTE_POINTS)]);
  });

  it('never sends more than 25 points in a request', () => {
    for (const count of [26, 49, 50, 100]) {
      for (const chunk of routeChunks(points(count))) {
        expect(chunk.length).toBeLessThanOrEqual(MAX_ROUTE_POINTS);
        expect(chunk.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('starts each part where the one before ended, so no drive is skipped', () => {
    const chunks = routeChunks(points(30));

    expect(chunks).toEqual([points(25), [24, 25, 26, 27, 28, 29]]);
  });

  it('covers every drive exactly once', () => {
    const count = 77;
    const legs = routeChunks(points(count)).reduce((sum, chunk) => sum + chunk.length - 1, 0);

    expect(legs).toBe(count - 1);
  });

  it('has nothing to send for fewer than two points', () => {
    expect(routeChunks(points(1))).toEqual([]);
    expect(routeChunks(points(0))).toEqual([]);
  });
});

describe('tripTimings', () => {
  const start = stop(1, 'start', 47.6, -122.3);

  it('leaves the start at the trip’s start time, and adds each drive to reach the next stop', () => {
    const stops = [start, stop(2, 'stop', 47.4, -120.3), stop(3, 'end', 46, -119)];

    const timings = tripTimings(stops, 'one-way', STARTS, [leg(2), leg(1.5)]);

    expect(timings?.stops.get(1)).toMatchObject({ arrivesAt: null, leavesAt: STARTS, drive: null });
    expect(timings?.stops.get(2)).toMatchObject({ arrivesAt: at(12, 11), leavesAt: at(12, 11) });
    expect(timings?.stops.get(3)).toMatchObject({ arrivesAt: at(12, 12, 30), leavesAt: null });
  });

  it('adds up the driving time and distance', () => {
    const stops = [start, stop(2, 'stop', 47.4, -120.3), stop(3, 'end', 46, -119)];

    const timings = tripTimings(stops, 'one-way', STARTS, [leg(2, 200), leg(1.5, 150)]);

    expect(timings?.totalDuration).toBe(3.5 * HOUR);
    expect(timings?.totalDistance).toBe(350_000);
  });

  it('leaves an overnight stop at 9 the next morning when it has no departure time', () => {
    const stops = [start, stop(2, 'overnight', 47.4, -120.3), stop(3, 'end', 46, -119)];

    const timings = tripTimings(stops, 'one-way', STARTS, [leg(8), leg(2)]);

    expect(timings?.stops.get(2)).toMatchObject({ arrivesAt: at(12, 17), leavesAt: at(13, 9) });
    expect(timings?.stops.get(3)).toMatchObject({ arrivesAt: at(13, 11) });
  });

  it('leaves an overnight stop at its departure time', () => {
    const stops = [
      start,
      stop(2, 'overnight', 47.4, -120.3, { departsAt: at(14, 7, 30) }),
      stop(3, 'end', 46, -119),
    ];

    const timings = tripTimings(stops, 'one-way', STARTS, [leg(8), leg(2)]);

    expect(timings?.stops.get(2)?.leavesAt).toEqual(at(14, 7, 30));
    expect(timings?.stops.get(3)?.arrivesAt).toEqual(at(14, 9, 30));
  });

  it('ignores a departure that isn’t after the arrival day, as the itinerary does', () => {
    const stops = [
      start,
      stop(2, 'overnight', 47.4, -120.3, { departsAt: at(12, 20) }),
      stop(3, 'end', 46, -119),
    ];

    const timings = tripTimings(stops, 'one-way', STARTS, [leg(8), leg(2)]);

    expect(timings?.stops.get(2)?.leavesAt).toEqual(at(13, 9));
  });

  it('never leaves before arriving, even after a drive past the next morning', () => {
    const stops = [start, stop(2, 'overnight', 47.4, -120.3), stop(3, 'end', 46, -119)];

    const timings = tripTimings(stops, 'one-way', STARTS, [leg(25), leg(1)]);

    expect(timings?.stops.get(2)).toMatchObject({ arrivesAt: at(13, 10), leavesAt: at(13, 10) });
  });

  it('lists each stop under its itinerary day', () => {
    const stops = [start, stop(2, 'overnight', 47.4, -120.3), stop(3, 'end', 46, -119)];

    const timings = tripTimings(stops, 'one-way', STARTS, [leg(8), leg(2)]);

    expect(timings?.stops.get(2)?.day).toEqual(at(12, 0));
    expect(timings?.stops.get(3)?.day).toEqual(at(13, 0));
  });

  it('times a round trip’s drive home to the start', () => {
    const stops = [start, stop(2, 'stop', 47.4, -120.3, { isTurnaround: true })];

    const timings = tripTimings(stops, 'round-trip', STARTS, [leg(2), leg(3)]);

    expect(timings?.stops.get(2)).toMatchObject({ arrivesAt: at(12, 11), leavesAt: at(12, 11) });
    expect(timings?.backToStart).toMatchObject({ arrivesAt: at(12, 14), drive: leg(3) });
  });

  it('has no drive home on a one-way trip', () => {
    const stops = [start, stop(2, 'end', 47.4, -120.3)];

    expect(tripTimings(stops, 'one-way', STARTS, [leg(2)])?.backToStart).toBeNull();
  });

  it('gives nothing when the legs were made for other stops, like while a new route loads', () => {
    const stops = [start, stop(2, 'stop', 47.4, -120.3), stop(3, 'end', 46, -119)];

    expect(tripTimings(stops, 'one-way', STARTS, [leg(2)])).toBeNull();
    expect(tripTimings([start], 'one-way', STARTS, [])).toBeNull();
  });
});

describe('stopTimingLabel', () => {
  const day = at(12, 0);

  it('says when the group leaves the start', () => {
    const timing = { arrivesAt: null, leavesAt: at(12, 9), drive: null, day };

    expect(stopTimingLabel({ stopType: 'start' }, timing)).toBe(`Leave ${formatTime(at(12, 9))}`);
  });

  it('says when the group arrives and how long the drive is', () => {
    const timing = { arrivesAt: at(12, 11, 30), leavesAt: at(12, 11, 30), drive: leg(2.5), day };

    expect(stopTimingLabel({ stopType: 'stop' }, timing)).toBe(
      `Arrive ${formatTime(at(12, 11, 30))} · 2 h 30 min drive`
    );
  });

  it('adds when the group leaves an overnight stop, with its weekday', () => {
    const timing = { arrivesAt: at(12, 17), leavesAt: at(13, 9), drive: leg(8), day };

    expect(stopTimingLabel({ stopType: 'overnight' }, timing)).toBe(
      `Arrive ${formatTime(at(12, 17))} · 8 h drive · Leave ${formatWeekday(at(13, 9))} ${formatTime(at(13, 9))}`
    );
  });

  it('adds the weekday to an arrival after midnight', () => {
    const timing = { arrivesAt: at(13, 1), leavesAt: at(13, 1), drive: leg(16), day };

    expect(stopTimingLabel({ stopType: 'stop' }, timing)).toBe(
      `Arrive ${formatWeekday(at(13, 1))} ${formatTime(at(13, 1))} · 16 h drive`
    );
  });
});

describe('formatDuration', () => {
  it.each([
    [20, '1 min'],
    [45 * 60, '45 min'],
    [2 * HOUR, '2 h'],
    [2 * HOUR + 5 * 60, '2 h 5 min'],
    [2 * HOUR + 59.6 * 60, '3 h'],
  ])('formats %d seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe('formatDistance', () => {
  it.each([
    [1609.344, '1.0 mi'],
    [6759.2448, '4.2 mi'],
    [220_444, '137 mi'],
  ])('formats %d meters as %s', (meters, expected) => {
    expect(formatDistance(meters)).toBe(expected);
  });
});

describe('routeTotalsLabel', () => {
  it('gives the driving time and distance', () => {
    const timings = tripTimings(
      [stop(1, 'start', 47.6, -122.3), stop(2, 'end', 46, -119)],
      'one-way',
      STARTS,
      [{ duration: 8 * HOUR + 50 * 60, distance: 824_000 }]
    );

    expect(timings && routeTotalsLabel(timings)).toBe('8 h 50 min driving · 512 mi');
  });
});
