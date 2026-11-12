/**
 * @file useTripRoute.ts
 * @description A trip's driving route, kept in step with its stops. Uses the saved route when it was
 * made for these stops, and otherwise asks Mapbox and saves the answer for the group's other phones
 */
import { routeKey, routePoints } from '@/src/domain/route';
import type { TripRoute } from '@/src/domain/route';
import { useAsync } from '@/src/hooks/useAsync';
import { reportError } from '@/src/lib/logger';
import { fetchRoute } from '@/src/services/mapboxDirectionsService';
import { getTripRoute, saveTripRoute } from '@/src/services/tripRouteService';
import type { TripStop, TripType } from '@/src/types/trip';

export type TripRouteState = {
  route: TripRoute | null; // null while loading, after an error, or with fewer than two places
  error: string | null;
  retry: () => void;
};

// stops must be in trip order. Pass undefined for either while they're still loading
export const useTripRoute = (
  tripId: number,
  stops: readonly TripStop[] | undefined,
  tripType: TripType | undefined
): TripRouteState => {
  const points = stops && tripType ? routePoints(stops, tripType) : [];
  const key = points.length > 0 ? routeKey(points) : null;

  // Runs again only when the points change. A stop's name or notes changing leaves the route alone
  const { data, error, reload } = useAsync(
    async () => {
      if (!key) return null;
      const saved = await getTripRoute(tripId);
      if (saved?.key === key) return saved;

      const fresh = await fetchRoute(points);
      // The route still shows if saving fails; the next phone to open the trip fetches its own
      saveTripRoute(tripId, fresh).catch((caught) =>
        reportError(caught, { scope: 'useTripRoute.save' })
      );
      return fresh;
    },
    [tripId, key],
    'useTripRoute'
  );

  // Until the new route arrives, the last one no longer matches the stops
  return {
    route: key && data?.key === key ? data : null,
    error: key ? error : null,
    retry: reload,
  };
};
