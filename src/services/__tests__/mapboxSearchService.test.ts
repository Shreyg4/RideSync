import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { retrievePlace, suggestPlaces } from '../mapboxSearchService';
import { toUserMessage } from '../errors';

const TOKEN = 'pk.test-token';
const SESSION = 'session-1';

const realFetch = global.fetch;
const realToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
let fetchMock: jest.Mock;

const respondWith = (body: unknown, status = 200) => {
  fetchMock.mockImplementation(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
};

// Splits the requested URL so a test can check its path and each query param
const requested = () => {
  const [url, options] = fetchMock.mock.calls[0] as [string, { signal?: AbortSignal }];
  const [path, query] = url.split('?');
  return { path, params: new URLSearchParams(query), signal: options.signal };
};

const feature = (properties: object = {}, coordinates = [-122.3493, 47.6205]) => ({
  geometry: { coordinates },
  properties: {
    mapbox_id: 'retrieved-id',
    name: 'Space Needle',
    full_address: '400 Broad Street, Seattle, Washington 98109, United States',
    place_formatted: 'Seattle, Washington 98109, United States',
    poi_category_ids: ['tourist_attraction'],
    ...properties,
  },
});

beforeEach(() => {
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN = TOKEN;
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = realFetch;
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN = realToken;
});

describe('suggestPlaces', () => {
  it('sends the query, session token and access token to /suggest', async () => {
    respondWith({ suggestions: [] });

    await suggestPlaces('coffee', SESSION);

    const { path, params } = requested();
    expect(path).toBe('https://api.mapbox.com/search/searchbox/v1/suggest');
    expect(params.get('q')).toBe('coffee');
    expect(params.get('session_token')).toBe(SESSION);
    expect(params.get('access_token')).toBe(TOKEN);
    expect(params.get('limit')).toBe('5');
  });

  it('sends proximity longitude first', async () => {
    respondWith({ suggestions: [] });

    await suggestPlaces('coffee', SESSION, { lat: 47.6, lng: -122.3 });

    expect(requested().params.get('proximity')).toBe('-122.3,47.6');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('leaves proximity out when the location is %s', async (_, proximity) => {
    respondWith({ suggestions: [] });

    await suggestPlaces('coffee', SESSION, proximity);

    expect(requested().params.has('proximity')).toBe(false);
  });

  it('never asks for category or brand results, which do not retrieve to a single place', async () => {
    respondWith({ suggestions: [] });

    await suggestPlaces('Starbucks', SESSION);

    const types = requested().params.get('types')?.split(',');
    expect(types).toContain('poi');
    expect(types).not.toContain('category');
    expect(types).not.toContain('brand');
  });

  it('encodes a query with spaces and symbols', async () => {
    respondWith({ suggestions: [] });

    await suggestPlaces('Joe & Sons Cafe', SESSION);

    expect(requested().params.get('q')).toBe('Joe & Sons Cafe');
  });

  it('prefers the full address, then the short one, then none', async () => {
    respondWith({
      suggestions: [
        { mapbox_id: 'a', name: 'Space Needle', full_address: 'Full', place_formatted: 'Short' },
        { mapbox_id: 'b', name: 'Seattle', place_formatted: 'Short' },
        { mapbox_id: 'c', name: 'France' },
      ],
    });

    await expect(suggestPlaces('x', SESSION)).resolves.toEqual([
      { mapboxId: 'a', name: 'Space Needle', address: 'Full' },
      { mapboxId: 'b', name: 'Seattle', address: 'Short' },
      { mapboxId: 'c', name: 'France', address: null },
    ]);
  });

  it('hands the abort signal to fetch so a stale search can be cancelled', async () => {
    respondWith({ suggestions: [] });
    const { signal } = new AbortController();

    await suggestPlaces('coffee', SESSION, null, signal);

    expect(requested().signal).toBe(signal);
  });

  it('lets a cancelled request reject as is, so the caller can ignore it', async () => {
    const aborted = new Error('Aborted');
    fetchMock.mockImplementation(async () => {
      throw aborted;
    });

    await expect(suggestPlaces('coffee', SESSION)).rejects.toBe(aborted);
  });
});

describe('retrievePlace', () => {
  it('reuses the session token and encodes the id in the path', async () => {
    respondWith({ features: [feature()] });

    await retrievePlace('abc/1=', SESSION);

    const { path, params } = requested();
    expect(path).toBe('https://api.mapbox.com/search/searchbox/v1/retrieve/abc%2F1%3D');
    expect(params.get('session_token')).toBe(SESSION);
    expect(params.get('access_token')).toBe(TOKEN);
  });

  it('reads the coordinates longitude first', async () => {
    respondWith({ features: [feature({}, [-122.3493, 47.6205])] });

    const place = await retrievePlace('id', SESSION);

    expect(place.lat).toBe(47.6205);
    expect(place.lng).toBe(-122.3493);
  });

  it('builds the place, using the id from the retrieve response', async () => {
    respondWith({ features: [feature()] });

    await expect(retrievePlace('suggested-id', SESSION)).resolves.toEqual({
      mapboxId: 'retrieved-id',
      name: 'Space Needle',
      address: '400 Broad Street, Seattle, Washington 98109, United States',
      lat: 47.6205,
      lng: -122.3493,
      category: 'attraction',
    });
  });

  it('falls back to the other category when the place has no category ids', async () => {
    respondWith({ features: [feature({ poi_category_ids: undefined })] });

    await expect(retrievePlace('id', SESSION)).resolves.toMatchObject({ category: 'other' });
  });

  it('shortens a long name to fit the column, with no trailing space', async () => {
    respondWith({ features: [feature({ name: `${'a'.repeat(99)} and more` })] });

    const { name } = await retrievePlace('id', SESSION);

    expect(name).toBe('a'.repeat(99));
  });

  it('throws a coded error when no place comes back', async () => {
    respondWith({ features: [] });

    await expect(retrievePlace('id', SESSION)).rejects.toMatchObject({
      code: 'mapbox_search_failed',
    });
  });

  it('hands the abort signal to fetch', async () => {
    respondWith({ features: [feature()] });
    const { signal } = new AbortController();

    await retrievePlace('id', SESSION, signal);

    expect(requested().signal).toBe(signal);
  });
});

describe('failed requests', () => {
  it.each([400, 401, 403, 429, 500])('turns a %i into a friendly coded error', async (status) => {
    respondWith({ message: 'nope' }, status);

    const error = await suggestPlaces('coffee', SESSION).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'mapbox_search_failed' });
    expect(toUserMessage(error)).toBe('Search is not available right now. Try again in a moment.');
  });

  it('keeps the token out of the error, because errors go to Sentry', async () => {
    respondWith({ message: 'nope' }, 401);

    const error = (await retrievePlace('id', SESSION).catch((e: unknown) => e)) as Error;

    expect(error.message).toBe('Mapbox search failed: 401');
    expect(JSON.stringify(error)).not.toContain(TOKEN);
  });

  it('makes no request when the token is missing', async () => {
    delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

    await expect(suggestPlaces('coffee', SESSION)).rejects.toThrow(
      'EXPO_PUBLIC_MAPBOX_TOKEN is not set'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
