/**
 * @file tripRouteService.ts
 * @description The data-access layer for a trip's saved driving route
 */
import { supabase } from '@/src/lib/supabase';
import type { RouteLeg, TripRoute } from '@/src/domain/route';

const isLegList = (value: unknown): value is RouteLeg[] =>
  Array.isArray(value) &&
  value.every(
    (leg) =>
      typeof leg === 'object' &&
      leg !== null &&
      typeof (leg as RouteLeg).duration === 'number' &&
      typeof (leg as RouteLeg).distance === 'number'
  );

// Null when no route is saved yet. Any member can save one, so a saved route that isn't shaped
// right is treated as missing, and the phone fetches its own
export const getTripRoute = async (tripId: number): Promise<TripRoute | null> => {
  const { data, error } = await supabase
    .from('trip_routes')
    .select('route_key, legs, geometry')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !isLegList(data.legs)) return null;
  return { key: data.route_key, legs: data.legs, geometry: data.geometry };
};

export const saveTripRoute = async (tripId: number, route: TripRoute): Promise<void> => {
  const { error } = await supabase.rpc('save_trip_route', {
    target_trip_id: tripId,
    new_route_key: route.key,
    new_legs: route.legs,
    new_geometry: route.geometry,
  });
  if (error) throw error;
};
