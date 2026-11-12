import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import { routeKey, routePoints } from '@/src/domain/route';
import type { TripRoute } from '@/src/domain/route';
import { fetchRoute } from '@/src/services/mapboxDirectionsService';
import { getTripRoute, saveTripRoute } from '@/src/services/tripRouteService';
import type { TripStop, TripType } from '@/src/types/trip';
import { useTripRoute } from '../useTripRoute';

jest.mock('@/src/services/mapboxDirectionsService', () => ({ fetchRoute: jest.fn() }));
jest.mock('@/src/services/tripRouteService', () => ({
  getTripRoute: jest.fn(),
  saveTripRoute: jest.fn(),
}));

const fetchMock = fetchRoute as unknown as jest.Mock<typeof fetchRoute>;
const getMock = getTripRoute as unknown as jest.Mock<typeof getTripRoute>;
const saveMock = saveTripRoute as unknown as jest.Mock<typeof saveTripRoute>;

const stop = (id: number, stopType: TripStop['stopType'], lat: number): TripStop => ({
  id,
  tripId: 1,
  position: id - 1,
  name: `Stop ${id}`,
  address: null,
  lat,
  lng: -122,
  mapboxId: null,
  stopType,
  stopCategory: 'other',
  notes: null,
  departsAt: null,
  isTurnaround: false,
});

const STOPS = [stop(1, 'start', 47.6), stop(2, 'end', 46.1)];

const routeFor = (stops: TripStop[], tripType: TripType = 'one-way'): TripRoute => {
  const points = routePoints(stops, tripType);
  return {
    key: routeKey(points),
    legs: points.slice(1).map(() => ({ duration: 3600, distance: 100000 })),
    geometry: ['line'],
  };
};

const render = (stops: TripStop[] | undefined, tripType: TripType | undefined = 'one-way') =>
  renderHook(({ s, t }) => useTripRoute(1, s, t), { initialProps: { s: stops, t: tripType } });

beforeEach(() => {
  jest.clearAllMocks();
  getMock.mockResolvedValue(null);
  saveMock.mockResolvedValue(undefined);
  fetchMock.mockImplementation(async (points) => ({
    key: routeKey(points),
    legs: points.slice(1).map(() => ({ duration: 3600, distance: 100000 })),
    geometry: ['fresh'],
  }));
});

describe('useTripRoute', () => {
  it('uses the saved route when it was made for these stops, without asking Mapbox', async () => {
    const saved = routeFor(STOPS);
    getMock.mockResolvedValue(saved);

    const { result } = await render(STOPS);

    await waitFor(() => expect(result.current.route).toEqual(saved));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('fetches and saves a new route when the saved one was made for other stops', async () => {
    getMock.mockResolvedValue({ ...routeFor(STOPS), key: 'old stops' });

    const { result } = await render(STOPS);

    await waitFor(() => expect(result.current.route?.geometry).toEqual(['fresh']));
    expect(fetchMock).toHaveBeenCalledWith(routePoints(STOPS, 'one-way'));
    expect(saveMock).toHaveBeenCalledWith(1, result.current.route);
  });

  it('fetches a route when none is saved yet', async () => {
    const { result } = await render(STOPS);

    await waitFor(() => expect(result.current.route?.key).toBe(routeFor(STOPS).key));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still shows the route when saving it fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    saveMock.mockRejectedValue(new Error('offline'));

    const { result } = await render(STOPS);

    await waitFor(() => expect(result.current.route).not.toBeNull());
    expect(result.current.error).toBeNull();
  });

  it('asks for nothing with fewer than two places, or while the stops load', async () => {
    const one = await render([stop(1, 'start', 47.6)]);
    const loading = await render(undefined, undefined);

    expect(one.result.current).toMatchObject({ route: null, error: null });
    expect(loading.result.current).toMatchObject({ route: null, error: null });
    expect(getMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches again when a stop moves, and drops the old route meanwhile', async () => {
    const { result, rerender } = await render(STOPS);
    await waitFor(() => expect(result.current.route).not.toBeNull());

    const moved = [STOPS[0], stop(2, 'end', 45)];
    let finish: (route: TripRoute) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    await rerender({ s: moved, t: 'one-way' });

    expect(result.current.route).toBeNull();
    finish(routeFor(moved));
    await waitFor(() => expect(result.current.route?.key).toBe(routeFor(moved).key));
  });

  it('leaves the route alone when only a stop’s name changes', async () => {
    const { result, rerender } = await render(STOPS);
    await waitFor(() => expect(result.current.route).not.toBeNull());

    await rerender({ s: [STOPS[0], { ...STOPS[1], name: 'Renamed' }], t: 'one-way' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('drives a round trip back to its start', async () => {
    const stops = [stop(1, 'start', 47.6), { ...stop(2, 'stop', 46.1), isTurnaround: true }];

    const { result } = await render(stops, 'round-trip');

    await waitFor(() => expect(result.current.route?.legs).toHaveLength(2));
  });

  it('gives a friendly error that can be retried', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(
      Object.assign(new Error('Mapbox directions failed: 500'), {
        code: 'mapbox_directions_failed',
      })
    );

    const { result } = await render(STOPS);
    await waitFor(() =>
      expect(result.current.error).toBe(
        'Directions are not available right now. Try again in a moment.'
      )
    );

    result.current.retry();

    await waitFor(() => expect(result.current.route).not.toBeNull());
  });
});
