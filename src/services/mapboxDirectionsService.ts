/**
 * @file mapboxDirectionsService.ts
 * @description The data-access layer for Mapbox Directions: the driving route through a trip's
 * points, with how long and how far each drive is
 */
import { routeChunks, routeKey } from '@/src/domain/route';
import type { RouteLeg, TripRoute } from '@/src/domain/route';
import type { Coordinates } from '@/src/types/trip';

const BASE_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';

type DirectionsResponse = {
  code?: string;
  routes?: { geometry: string; legs: RouteLeg[] }[];
};

// What Mapbox answers when there's no road between the points, like a stop out at sea. It sends
// these with a 200, so the code is what tells them apart
const UNDRIVABLE = new Set(['NoRoute', 'NoSegment']);

// Never puts the request URL in the message: it holds the token, and errors are sent to Sentry
const directionsFailed = (reason: string | number, code = 'mapbox_directions_failed') =>
  Object.assign(new Error(`Mapbox directions failed: ${reason}`), { code });

const fetchPart = async (points: Coordinates[], token: string, signal?: AbortSignal) => {
  const query = new URLSearchParams({
    geometries: 'polyline6',
    // The whole line, so it follows the roads when the map is zoomed in
    overview: 'full',
    access_token: token,
  }).toString();
  const response = await fetch(`${BASE_URL}/${routeKey(points)}?${query}`, { signal });

  let body: DirectionsResponse | null = null;
  try {
    body = (await response.json()) as DirectionsResponse;
  } catch {
    // Not JSON, so the status is all there is to go on
  }

  if (body?.code && UNDRIVABLE.has(body.code))
    throw directionsFailed(body.code, 'route_not_drivable');
  const route = body?.routes?.[0];
  if (!response.ok || body?.code !== 'Ok' || !route) {
    throw directionsFailed(body?.code ?? response.status);
  }

  return {
    // Only what the app uses. Each leg also carries steps and other details
    legs: route.legs.map(({ duration, distance }) => ({ duration, distance })),
    geometry: route.geometry,
  };
};

// Asks for every part at once. Parts share their joining point, so their legs follow on in order
export const fetchRoute = async (
  points: readonly Coordinates[],
  signal?: AbortSignal
): Promise<TripRoute> => {
  if (points.length < 2) throw new Error('A route needs at least two points');
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error('EXPO_PUBLIC_MAPBOX_TOKEN is not set');

  const parts = await Promise.all(
    routeChunks(points).map((chunk) => fetchPart(chunk, token, signal))
  );
  return {
    key: routeKey(points),
    legs: parts.flatMap((part) => part.legs),
    geometry: parts.map((part) => part.geometry),
  };
};
