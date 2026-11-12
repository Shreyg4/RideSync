import { describe, expect, it } from '@jest/globals';
import { mockRpc, mockSupabase, mockTable } from '@/src/test/supabase';
import { getTripRoute, saveTripRoute } from '../tripRouteService';

const route = {
  key: '-122.300000,47.600000;-120.300000,47.400000',
  legs: [{ duration: 7200, distance: 200000 }],
  geometry: ['line'],
};

describe('getTripRoute', () => {
  it('reads the trip’s saved route', async () => {
    mockTable('trip_routes').__setResult({
      data: { route_key: route.key, legs: route.legs, geometry: route.geometry },
      error: null,
    });

    await expect(getTripRoute(7)).resolves.toEqual(route);
    expect(mockTable('trip_routes').eq).toHaveBeenCalledWith('trip_id', 7);
  });

  it('gives null when no route is saved yet', async () => {
    mockTable('trip_routes').__setResult({ data: null, error: null });

    await expect(getTripRoute(7)).resolves.toBeNull();
  });

  it.each([
    ['not a list', { duration: 1, distance: 1 }],
    ['a leg missing its distance', [{ duration: 1 }]],
    ['a leg that isn’t an object', [null]],
  ])('treats saved legs that are %s as no route, so the phone fetches its own', async (_, legs) => {
    mockTable('trip_routes').__setResult({
      data: { route_key: route.key, legs, geometry: route.geometry },
      error: null,
    });

    await expect(getTripRoute(7)).resolves.toBeNull();
  });

  it('throws a failed read', async () => {
    const failure = { code: '42501' };
    mockTable('trip_routes').__setResult({ data: null, error: failure });

    await expect(getTripRoute(7)).rejects.toBe(failure);
  });
});

describe('saveTripRoute', () => {
  it('saves the route for the trip', async () => {
    await saveTripRoute(7, route);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('save_trip_route', {
      target_trip_id: 7,
      new_route_key: route.key,
      new_legs: route.legs,
      new_geometry: route.geometry,
    });
  });

  it('throws a failed save', async () => {
    const failure = { code: '42501' };
    mockRpc('save_trip_route', { error: failure });

    await expect(saveTripRoute(7, route)).rejects.toBe(failure);
  });
});
