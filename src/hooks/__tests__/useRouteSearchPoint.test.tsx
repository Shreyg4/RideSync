import { describe, expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { routeSections } from '@/src/domain/route';
import type { RouteSections } from '@/src/domain/route';
import { distanceMeters } from '@/src/lib/geo';
import type { TripStop } from '@/src/types/trip';
import { SEARCH_RADIUS_MILES, useRouteSearchPoint } from '../useRouteSearchPoint';

const HOUR = 3600;
const D = distanceMeters([0, 0], [1, 0]);

const stop = (
  id: number,
  stopType: TripStop['stopType'],
  lng: number,
  isTurnaround = false
): TripStop => ({
  id,
  tripId: 1,
  position: id - 1,
  name: `Stop ${id}`,
  address: null,
  lat: 0,
  lng,
  mapboxId: null,
  stopType,
  stopCategory: 'other',
  notes: null,
  departsAt: null,
  isTurnaround,
});

// Two hours out to a destination two degrees east, then one hour home
const ROUND_TRIP = routeSections(
  [stop(1, 'start', 0), stop(2, 'stop', 2, true)],
  'round-trip',
  [
    { duration: 2 * HOUR, distance: 2 * D },
    { duration: HOUR, distance: 2 * D },
  ],
  [
    [0, 0],
    [2, 0],
    [0, 0],
  ]
)!;

const ONE_WAY = routeSections(
  [stop(1, 'start', 0), stop(2, 'end', 3)],
  'one-way',
  [{ duration: 3 * HOUR + 7 * 60, distance: 3 * D }],
  [
    [0, 0],
    [3, 0],
  ]
)!;

const render = (sections: RouteSections | null) =>
  renderHook(({ s }) => useRouteSearchPoint(s), { initialProps: { s: sections } });

describe('useRouteSearchPoint', () => {
  it('has no point until there’s a route', async () => {
    const { result } = await render(null);

    expect(result.current).toMatchObject({
      section: null,
      point: null,
      seconds: 0,
      hasReturn: false,
    });
  });

  it('can start on the way home, halfway into that drive', async () => {
    const { result } = await renderHook(() => useRouteSearchPoint(ROUND_TRIP, 'return'));

    expect(result.current.direction).toBe('return');
    expect(result.current.seconds).toBe(HOUR / 2);
  });

  it('starts on the way there when asked for the way home of a trip without one', async () => {
    const { result } = await renderHook(() => useRouteSearchPoint(ONE_WAY, 'return'));

    expect(result.current.direction).toBe('outbound');
  });

  it('starts on the way there, halfway into its drive, with the default radius', async () => {
    const { result } = await render(ROUND_TRIP);

    expect(result.current.direction).toBe('outbound');
    expect(result.current.seconds).toBe(HOUR);
    expect(result.current.point?.lng).toBeCloseTo(1, 6);
    expect(result.current.radiusMiles).toBe(SEARCH_RADIUS_MILES.initial);
    expect(result.current.hasReturn).toBe(true);
  });

  it('keeps the time on five-minute steps, even when the drive’s length isn’t one', async () => {
    const { result } = await render(ONE_WAY);

    // Halfway into 3 h 7 min is 1 h 33.5 min, so the nearest step is 1 h 35 min
    expect(result.current.seconds).toBe(95 * 60);
  });

  it('moves the point with the time', async () => {
    const { result } = await render(ROUND_TRIP);

    await act(async () => result.current.setSeconds(30 * 60));

    expect(result.current.seconds).toBe(30 * 60);
    expect(result.current.point?.lng).toBeCloseTo(0.5, 6);
    expect(result.current.point?.legIndex).toBe(0);
  });

  it('switches to the way back, starting halfway home', async () => {
    const { result } = await render(ROUND_TRIP);
    await act(async () => result.current.setSeconds(15 * 60));

    await act(async () => result.current.setDirection('return'));

    expect(result.current.direction).toBe('return');
    expect(result.current.section?.duration).toBe(HOUR);
    expect(result.current.seconds).toBe(30 * 60);
    expect(result.current.point?.lng).toBeCloseTo(1, 6);
    expect(result.current.point?.legIndex).toBe(1);
  });

  it('searches the whole trip from Full trip, starting halfway', async () => {
    const { result } = await render(ROUND_TRIP);

    await act(async () => result.current.setDirection('full'));

    expect(result.current.direction).toBe('full');
    expect(result.current.section?.duration).toBe(3 * HOUR);
    expect(result.current.seconds).toBe(1.5 * HOUR);
    expect(result.current.point?.lng).toBeCloseTo(1.5, 6);
    expect(result.current.point?.legIndex).toBe(0);
  });

  it('stays on the way there when a one-way trip is asked for the way back', async () => {
    const { result } = await render(ONE_WAY);

    await act(async () => result.current.setDirection('return'));

    expect(result.current.direction).toBe('outbound');
    expect(result.current.hasReturn).toBe(false);
    expect(result.current.section).toBe(ONE_WAY.outbound);
  });

  it('keeps a chosen time inside a route that got shorter', async () => {
    const { result, rerender } = await render(ROUND_TRIP);
    await act(async () => result.current.setSeconds(2 * HOUR));

    await rerender({ s: ONE_WAY });
    expect(result.current.seconds).toBe(2 * HOUR);

    const short = routeSections(
      [stop(1, 'start', 0), stop(2, 'end', 1)],
      'one-way',
      [{ duration: HOUR, distance: D }],
      [
        [0, 0],
        [1, 0],
      ]
    );
    await rerender({ s: short });
    expect(result.current.seconds).toBe(HOUR);
  });

  it('changes the radius', async () => {
    const { result } = await render(ROUND_TRIP);

    await act(async () => result.current.setRadiusMiles(20));

    expect(result.current.radiusMiles).toBe(20);
  });
});
