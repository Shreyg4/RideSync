/**
 * @file mapboxSearchService.ts
 * @description The data-access layer for Mapbox Search Box.
 */
import { STOP_NAME_MAX_LENGTH, toStopCategory } from '@/src/domain/rules';
import type { Coordinates, Place, PlaceSuggestion } from '@/src/types/trip';

const BASE_URL = 'https://api.mapbox.com/search/searchbox/v1';
const SUGGEST_LIMIT = 5;

// Leaves out 'category' and 'brand'. Those are groups of places, so retrieving one returns several
// features and the first is an arbitrary place, not what the user tapped
const PLACE_TYPES =
  'country,region,postcode,district,place,locality,neighborhood,street,address,poi';

type MapboxPlace = {
  mapbox_id: string;
  name: string;
  // Not every result has these: a country's suggestion has neither
  full_address?: string;
  place_formatted?: string;
};

type SuggestResponse = {
  suggestions: MapboxPlace[];
};

type RetrieveResponse = {
  features: {
    geometry: { coordinates: [lng: number, lat: number] };
    properties: MapboxPlace & { poi_category_ids?: string[] };
  }[];
};

const searchFailed = (reason: string | number) =>
  Object.assign(new Error(`Mapbox search failed: ${reason}`), { code: 'mapbox_search_failed' });

const request = async <T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<T> => {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error('EXPO_PUBLIC_MAPBOX_TOKEN is not set');

  const query = new URLSearchParams({ ...params, access_token: token }).toString();
  const response = await fetch(`${BASE_URL}${path}?${query}`, { signal });

  if (!response.ok) throw searchFailed(response.status);
  return (await response.json()) as T;
};

const addressOf = ({ full_address, place_formatted }: MapboxPlace) =>
  full_address ?? place_formatted ?? null;

export const suggestPlaces = async (
  query: string,
  sessionToken: string,
  proximity?: Coordinates | null,
  signal?: AbortSignal
): Promise<PlaceSuggestion[]> => {
  const params: Record<string, string> = {
    q: query,
    session_token: sessionToken,
    limit: String(SUGGEST_LIMIT),
    types: PLACE_TYPES,
  };
  // Mapbox falls back to biasing by IP without this
  if (proximity) params.proximity = `${proximity.lng},${proximity.lat}`;

  const { suggestions } = await request<SuggestResponse>('/suggest', params, signal);

  return suggestions.map((suggestion) => ({
    mapboxId: suggestion.mapbox_id,
    name: suggestion.name,
    address: addressOf(suggestion),
  }));
};

export const retrievePlace = async (
  mapboxId: string,
  sessionToken: string,
  signal?: AbortSignal
): Promise<Place> => {
  const { features } = await request<RetrieveResponse>(
    `/retrieve/${encodeURIComponent(mapboxId)}`,
    { session_token: sessionToken },
    signal
  );

  const feature = features[0];
  if (!feature) throw searchFailed('no place returned');

  const { geometry, properties } = feature;
  const [lng, lat] = geometry.coordinates;

  return {
    // Can differ from the suggestion's id, and this is the one that identifies the saved place
    mapboxId: properties.mapbox_id,
    name: properties.name.slice(0, STOP_NAME_MAX_LENGTH).trim(),
    address: addressOf(properties),
    lat,
    lng,
    category: toStopCategory(properties.poi_category_ids),
  };
};
