import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fetchRoute } from '../mapboxDirectionsService';
import { toUserMessage } from '../errors';
import { MAX_ROUTE_POINTS } from '@/src/domain/route';

const TOKEN = 'pk.test-token';
const realFetch = global.fetch;
const realToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
let fetchMock: jest.Mock;

const ok = (legCount: number, geometry = 'line') => ({
  code: 'Ok',
  routes: [
    {
      geometry,
      duration: 999,
      distance: 999,
      legs: Array.from({ length: legCount }, (_, i) => ({
        duration: (i + 1) * 60,
        distance: (i + 1) * 1000,
        steps: [],
        summary: 'I-90',
      })),
    },
  ],
});

// Answers each request for the number of points it asks for, so chunked calls get the right legs
const answerByPoints = () =>
  fetchMock.mockImplementation(async (url: unknown) => {
    const path = String(url).split('?')[0];
    const pairs = path.slice(path.lastIndexOf('/') + 1).split(';').length;
    return { ok: true, status: 200, json: async () => ok(pairs - 1, `line-${pairs}`) };
  });

const respondWith = (body: unknown, status = 200) =>
  fetchMock.mockImplementation(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));

const requestedUrl = (call = 0) => new URL(String(fetchMock.mock.calls[call][0]));
const requestedPairs = (call = 0) => {
  const { pathname } = requestedUrl(call);
  return pathname.slice(pathname.lastIndexOf('/') + 1).split(';');
};

const points = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ lat: 47 + i / 100, lng: -122 + i / 100 }));

beforeEach(() => {
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN = TOKEN;
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = realFetch;
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN = realToken;
});

describe('fetchRoute', () => {
  it('asks for a driving route through the points, longitude first', async () => {
    answerByPoints();

    await fetchRoute([
      { lat: 47.6205, lng: -122.3493 },
      { lat: 47.431, lng: -120.324 },
    ]);

    const url = requestedUrl();
    expect(url.origin + url.pathname).toBe(
      'https://api.mapbox.com/directions/v5/mapbox/driving/-122.349300,47.620500;-120.324000,47.431000'
    );
    expect(url.searchParams.get('geometries')).toBe('polyline6');
    expect(url.searchParams.get('overview')).toBe('full');
    expect(url.searchParams.get('access_token')).toBe(TOKEN);
  });

  it('keeps only each leg’s time and distance, keyed to the points', async () => {
    answerByPoints();
    const trip = points(3);

    const route = await fetchRoute(trip);

    expect(route.legs).toEqual([
      { duration: 60, distance: 1000 },
      { duration: 120, distance: 2000 },
    ]);
    expect(route.geometry).toEqual(['line-3']);
    expect(route.key).toBe(requestedPairs().join(';'));
  });

  it('splits a long trip into requests of at most 25 points that join up', async () => {
    answerByPoints();

    const route = await fetchRoute(points(30));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedPairs(0)).toHaveLength(MAX_ROUTE_POINTS);
    expect(requestedPairs(1)).toHaveLength(6);
    expect(requestedPairs(1)[0]).toBe(requestedPairs(0)[MAX_ROUTE_POINTS - 1]);
    expect(route.legs).toHaveLength(29);
    expect(route.geometry).toEqual(['line-25', 'line-6']);
  });

  it('says when there is no road between the stops', async () => {
    respondWith({ code: 'NoSegment', message: 'Could not find a matching segment', routes: [] });

    const error = await fetchRoute(points(2)).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'route_not_drivable' });
    expect(toUserMessage(error)).toBe('There is no driving route between these stops.');
  });

  it.each([
    ['an error status', { code: 'InvalidInput', message: 'Too many coordinates' }, 422],
    ['a 401', { message: 'Not Authorized' }, 401],
    ['an answer with no route', { code: 'Ok', routes: [] }, 200],
  ])('turns %s into a friendly coded error', async (_, body, status) => {
    respondWith(body, status);

    const error = await fetchRoute(points(2)).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'mapbox_directions_failed' });
    expect(toUserMessage(error)).toBe(
      'Directions are not available right now. Try again in a moment.'
    );
  });

  it('copes with an answer that isn’t JSON', async () => {
    fetchMock.mockImplementation(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    }));

    await expect(fetchRoute(points(2))).rejects.toMatchObject({
      code: 'mapbox_directions_failed',
      message: 'Mapbox directions failed: 502',
    });
  });

  it('keeps the token out of the error, because errors go to Sentry', async () => {
    respondWith({ message: 'Not Authorized' }, 401);

    const error = (await fetchRoute(points(2)).catch((e: unknown) => e)) as Error;

    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(TOKEN);
  });

  it('makes no request without a token or without two points', async () => {
    await expect(fetchRoute(points(1))).rejects.toThrow('at least two points');

    delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    await expect(fetchRoute(points(2))).rejects.toThrow('EXPO_PUBLIC_MAPBOX_TOKEN is not set');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
