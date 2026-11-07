import { describe, expect, it } from '@jest/globals';
import { resolveHref } from 'expo-router/build/link/href';
import type { Place } from '@/src/types/trip';
import { parsePlaceParam, toPlaceParam } from '../placeParam';

const place = (name: string): Place => ({
  mapboxId: 'id-1',
  name,
  address: '400 Broad Street, Seattle',
  lat: 47.6205,
  lng: -122.3493,
  category: 'attraction',
});

// The trip a param really takes: expo-router's encoder, its URL parser, then the extra decode
// useLocalSearchParams does. Copied from that hook because it can't run outside a route
const throughRouter = (value: string) => {
  const href = resolveHref({
    pathname: '/trips/[id]/stopDetails',
    params: { id: 1, place: value },
  });
  const parsed = new URL(href, 'https://phony.example').searchParams.get('place') ?? '';
  try {
    return decodeURIComponent(parsed);
  } catch {
    return parsed;
  }
};

describe('placeParam', () => {
  it.each(['Space Needle', 'Joe & Sons', '100% Burgers', '50%20 off', '50%25 sale', 'Zoë 🚗 #1'])(
    'brings %s through the router unchanged',
    (name) => {
      const original = place(name);

      expect(parsePlaceParam(throughRouter(toPlaceParam(original)))).toEqual(original);
    }
  );

  it.each([
    ['a missing param', undefined],
    ['a repeated param', ['{}', '{}']],
    ['text that is not JSON', 'not json'],
    ['JSON null', 'null'],
    ['a place with no coordinates', JSON.stringify({ mapboxId: 'id', name: 'x' })],
    ['coordinates that are not numbers', JSON.stringify({ ...place('x'), lat: '47' })],
  ])('rejects %s', (_, value) => {
    expect(parsePlaceParam(value)).toBeNull();
  });
});
