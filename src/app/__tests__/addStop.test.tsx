// Runs the real hook and service with only fetch faked, so these check the requests that actually
// reach Mapbox as well as what the screen does with the answers.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { BackHandler, StyleSheet } from 'react-native';
import { spacing } from '@/src/constants/theme';
import * as Mapbox from '@rnmapbox/maps';
import AddStopScreen from '../trips/[id]/addStop';
import { parsePlaceParam } from '@/src/lib/placeParam';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockTable } from '@/src/test/supabase';
import { savedRouteRow } from '@/src/test/route';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));

let mockTokenCount = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `token-${++mockTokenCount}`,
}));

const requestPermission = Location.requestForegroundPermissionsAsync as unknown as jest.Mock<
  () => Promise<{ granted: boolean }>
>;
const lastKnown = Location.getLastKnownPositionAsync as unknown as jest.Mock<
  () => Promise<{ coords: { latitude: number; longitude: number } } | null>
>;

const DEBOUNCE_MS = 300;
const SUGGESTION = {
  mapbox_id: 'needle-suggested',
  name: 'Space Needle',
  full_address: '400 Broad Street, Seattle',
};
const FEATURE = {
  geometry: { coordinates: [-122.3493, 47.6205] },
  properties: {
    mapbox_id: 'needle-retrieved',
    name: 'Space Needle',
    full_address: '400 Broad Street, Seattle',
    poi_category_ids: ['tourist_attraction'],
  },
};

// Slider labels are hidden from screen readers, which hear the slider itself
const HIDDEN = { includeHiddenElements: true };

const realFetch = global.fetch;
const realToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
let fetchMock: jest.Mock<(url: string) => Promise<unknown>>;

const answers = (suggestions: unknown[] = [SUGGESTION], features: unknown[] = [FEATURE]) => {
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => (url.includes('/suggest') ? { suggestions } : { features }),
  }));
};

const requests = (path: string) =>
  fetchMock.mock.calls
    .map(([url]) => url)
    .filter((url) => url.includes(path))
    .map((url) => new URLSearchParams(url.split('?')[1]));

const withStopType = (stopType?: string, extra: Record<string, string> = {}) =>
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: '1', stopType, ...extra });

const renderAddStop = async (stopType = 'stop', extra: Record<string, string> = {}) => {
  withStopType(stopType, extra);
  const view = await renderScreen(<AddStopScreen />, signedInAuth());
  await view.findByTestId('add-stop-map');
  return view;
};

type View = Awaited<ReturnType<typeof renderAddStop>>;

const search = async (view: View, text: string) => {
  await fireEvent.changeText(view.getByTestId('place-search-input'), text);
  await act(async () => void (await jest.advanceTimersByTimeAsync(DEBOUNCE_MS)));
};

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockTokenCount = 0;
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN = 'pk.test-token';
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  answers();
  requestPermission.mockResolvedValue({ granted: true });
  lastKnown.mockResolvedValue({ coords: { latitude: 47.6, longitude: -122.3 } });
});

afterEach(() => {
  global.fetch = realFetch;
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN = realToken;
  jest.useRealTimers();
});

describe('AddStopScreen', () => {
  it.each([
    ['start', 'Where does the trip start?'],
    ['end', 'Where does the trip end?'],
    ['destination', 'Where are you headed?'],
    ['stop', 'Search for a place'],
  ])('has no title, and the search box says what a %s search is for', async (type, hint) => {
    const view = await renderAddStop(type);

    expect(view.queryByText('Add Stop')).toBeNull();
    expect(view.getByPlaceholderText(hint)).toBeTruthy();
  });

  describe('opening the screen', () => {
    it('fills the screen with a map that takes touches', async () => {
      const view = await renderAddStop();

      expect(view.getByTestId('add-stop-map')).toBeTruthy();
      expect(view.getByTestId('add-stop-map-touch').props.pointerEvents).toBe('auto');
      expect(view.queryByTestId('add-stop-backdrop')).toBeNull();
    });

    it('puts the back button right beside the search box', async () => {
      const view = await renderAddStop();
      const row = view.getByTestId('place-search-bar');

      expect(row).toContainElement(view.getByLabelText('Go back'));
      expect(row).toContainElement(view.getByTestId('place-search-input'));
    });

    it('leaves the screen from the back button when search is closed', async () => {
      const view = await renderAddStop();

      await fireEvent.press(view.getByLabelText('Go back'));

      expect(router.back).toHaveBeenCalledTimes(1);
    });

    it.each(['start', 'end', 'stop'])(
      'opens a %s search on the map, with the keyboard closed',
      async (stopType) => {
        const view = await renderAddStop(stopType);

        expect(view.queryByTestId('add-stop-backdrop')).toBeNull();
        expect(view.getByTestId('place-search-input').props.autoFocus).toBeUndefined();
      }
    );
  });

  describe('pressing the search box', () => {
    const focus = (view: View) => fireEvent(view.getByTestId('place-search-input'), 'focus');
    const blur = (view: View) => fireEvent(view.getByTestId('place-search-input'), 'blur');

    it('darkens the map behind the results and stops it taking touches, without reloading it', async () => {
      const view = await renderAddStop();
      const map = view.getByTestId('add-stop-map');

      await focus(view);

      expect(view.getByTestId('add-stop-backdrop')).toBeTruthy();
      expect(view.getByTestId('add-stop-map-touch').props.pointerEvents).toBe('none');
      expect(view.getByTestId('add-stop-map')).toBe(map);
    });

    it('brings the map back when the keyboard closes on an empty box', async () => {
      const view = await renderAddStop();
      await focus(view);

      await blur(view);

      expect(view.queryByTestId('add-stop-backdrop')).toBeNull();
      expect(view.getByTestId('add-stop-map-touch').props.pointerEvents).toBe('auto');
    });

    it('keeps the results when the keyboard closes on typed text', async () => {
      const view = await renderAddStop();
      await focus(view);
      await search(view, 'Space');

      await blur(view);

      expect(view.getByText('Space Needle')).toBeTruthy();
      expect(view.getByTestId('add-stop-backdrop')).toBeTruthy();
    });

    it('goes back to the map from the close button, clearing the text', async () => {
      const view = await renderAddStop();
      await focus(view);
      await search(view, 'Space');

      await fireEvent.press(view.getByLabelText('Close search'));

      expect(router.back).not.toHaveBeenCalled();
      expect(view.getByTestId('place-search-input').props.value).toBe('');
      expect(view.queryByTestId('add-stop-backdrop')).toBeNull();
      expect(view.queryByText('Space Needle')).toBeNull();
    });

    it('swaps the back button for a close button only while search is open', async () => {
      const view = await renderAddStop();
      expect(view.getByLabelText('Go back')).toBeTruthy();
      expect(view.queryByLabelText('Close search')).toBeNull();

      await focus(view);
      expect(view.getByLabelText('Close search')).toBeTruthy();
      expect(view.queryByLabelText('Go back')).toBeNull();

      await fireEvent.press(view.getByLabelText('Close search'));
      expect(view.getByLabelText('Go back')).toBeTruthy();
    });

    it('keeps the close button when the keyboard closes on typed text', async () => {
      const view = await renderAddStop();
      await focus(view);
      await search(view, 'Space');

      await blur(view);

      expect(view.getByLabelText('Close search')).toBeTruthy();
    });
  });

  it('lets the Android back button close search before it leaves the screen', async () => {
    const listen = jest.spyOn(BackHandler, 'addEventListener');
    const view = await renderAddStop();
    expect(listen).not.toHaveBeenCalled();

    await search(view, 'Space');
    const onBack = listen.mock.calls[0][1];
    let handled: boolean | null | undefined;
    await act(async () => {
      handled = onBack();
    });

    expect(handled).toBe(true);
    expect(view.getByTestId('place-search-input').props.value).toBe('');
    expect(view.getByLabelText('Go back')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  describe('the trip’s stops on the map', () => {
    const NOW = new Date(2026, 8, 2, 9, 30).toISOString();
    const stopRow = (id: number, stop_type: string, name: string) => ({
      id,
      trip_id: 1,
      position: id - 1,
      name,
      address: null,
      lat: 47.6 - id,
      lng: -122.3,
      mapbox_id: null,
      stop_type,
      category: 'other',
      notes: null,
      departs_at: null,
      is_turnaround: false,
      created_at: NOW,
      updated_at: NOW,
    });

    it('pins this trip’s stops, numbered in trip order', async () => {
      mockTable('trip_stops').__setResult({
        data: [stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast')],
        error: null,
      });
      const view = await renderAddStop();

      expect(await view.findByLabelText('Stop 1, Home')).toHaveTextContent('1');
      expect(view.getByLabelText('Stop 2, Coast')).toHaveTextContent('2');
      expect(view.getByTestId('add-stop-map')).toContainElement(view.getByTestId('map-pin-2'));
      expect(mockTable('trip_stops').eq).toHaveBeenCalledWith('trip_id', 1);
    });

    it('draws the trip’s saved route under the pins, without asking Mapbox again', async () => {
      const stops = [stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast')];
      mockTable('trips').__setResult({
        data: { id: 1, name: 'Coast Run', starts_at: NOW, trip_type: 'one-way' },
        error: null,
      });
      mockTable('trip_stops').__setResult({ data: stops, error: null });
      mockTable('trip_routes').__setResult({ data: savedRouteRow(stops, 'one-way'), error: null });
      const view = await renderAddStop();

      expect(await view.findByTestId('mapbox-shape')).toBeTruthy();
      expect(view.getByTestId('add-stop-map')).toContainElement(view.getByTestId('mapbox-shape'));
      expect(requests('/directions')).toHaveLength(0);
    });

    it('draws no route before the trip has two places', async () => {
      mockTable('trips').__setResult({
        data: { id: 1, name: 'Coast Run', starts_at: NOW, trip_type: 'one-way' },
        error: null,
      });
      mockTable('trip_stops').__setResult({ data: [stopRow(1, 'start', 'Home')], error: null });
      const view = await renderAddStop();
      await view.findByLabelText('Stop 1, Home');

      expect(view.queryByTestId('mapbox-shape')).toBeNull();
    });

    it('fits the map to every stop, like the planner’s map', async () => {
      mockTable('trip_stops').__setResult({
        data: [stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast')],
        error: null,
      });
      const view = await renderAddStop();
      await view.findByLabelText('Stop 1, Home');

      const camera = view.getByTestId('mapbox-camera');
      expect(camera.props.bounds).toEqual({ ne: [-122.3, 46.6], sw: [-122.3, 45.6] });
      // Opens there instead of flying in from the user's location
      expect(camera.props.defaultSettings.bounds).toEqual({
        ne: [-122.3, 46.6],
        sw: [-122.3, 45.6],
      });
    });

    it('fits the pins below the search bar with a wide margin, so they sit well inside the screen', async () => {
      mockTable('trip_stops').__setResult({
        data: [stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast')],
        error: null,
      });
      const view = await renderAddStop();
      await view.findByLabelText('Stop 1, Home');

      // The bar ends below the test's 47-point status bar, a 10-point gap and its own 52 points.
      // With no route there's nothing to search along, so no chips or panel take more room
      const { padding } = view.getByTestId('mapbox-camera').props;
      expect(padding.paddingTop).toBe(100 + 47 + 10 + 52);
      expect(padding.paddingBottom).toBe(100);
    });

    it('leaves room for the search bar alone when there are no map search controls', async () => {
      mockTable('trip_stops').__setResult({
        data: [stopRow(1, 'start', 'Home'), stopRow(2, 'stop', 'Lunch')],
        error: null,
      });
      const view = await renderAddStop('end');
      await view.findByLabelText('Stop 1, Home');

      expect(view.getByTestId('mapbox-camera').props.padding.paddingTop).toBe(100 + 47 + 10 + 52);
    });

    it('centers on the user before the trip has any stops', async () => {
      mockTable('trip_stops').__setResult({ data: [], error: null });
      const view = await renderAddStop('start');

      const camera = view.getByTestId('mapbox-camera');
      expect(camera.props.defaultSettings.centerCoordinate).toEqual([-122.3, 47.6]);
      expect(camera.props.bounds).toBeUndefined();
    });

    it('keeps the pins from being tapped, since that would leave search', async () => {
      mockTable('trip_stops').__setResult({ data: [stopRow(1, 'start', 'Home')], error: null });
      const view = await renderAddStop();

      expect(await view.findByLabelText('Stop 1, Home')).toBeDisabled();
    });

    it('still searches when the stops fail to load, just without pins', async () => {
      mockTable('trip_stops').__setResult({ data: null, error: { code: '42501' } });
      const view = await renderAddStop();
      await search(view, 'Space');

      expect(view.getByText('Space Needle')).toBeTruthy();
      expect(view.queryByTestId(/^map-pin-/)).toBeNull();
    });
  });

  it('limits the search box to what Mapbox accepts', async () => {
    const view = await renderAddStop();

    expect(view.getByTestId('place-search-input').props.maxLength).toBe(256);
  });

  it('centers the map on the user, longitude first', async () => {
    const view = await renderAddStop();

    expect(view.getByTestId('mapbox-camera').props.defaultSettings.centerCoordinate).toEqual([
      -122.3, 47.6,
    ]);
  });

  it('still opens the map and searches without location permission', async () => {
    requestPermission.mockResolvedValue({ granted: false });
    const view = await renderAddStop();
    expect(view.queryByTestId('mapbox-camera')).toBeNull();

    await search(view, 'Space');

    expect(requests('/suggest')[0].has('proximity')).toBe(false);
    expect(view.getByText('Space Needle')).toBeTruthy();
  });

  it('biases the search request to the user, longitude first', async () => {
    const view = await renderAddStop();

    await search(view, 'Space');

    const [request] = requests('/suggest');
    expect(request.get('q')).toBe('Space');
    expect(request.get('proximity')).toBe('-122.3,47.6');
  });

  it('shows each result with its address', async () => {
    const view = await renderAddStop();

    await search(view, 'Space');

    expect(view.getByText('Space Needle')).toBeTruthy();
    expect(view.getByText('400 Broad Street, Seattle')).toBeTruthy();
  });

  it('says so when nothing matches', async () => {
    answers([]);
    const view = await renderAddStop();

    await search(view, 'zzzz');

    expect(view.getByText('No places found')).toBeTruthy();
  });

  it('shows a friendly message when the search fails', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500 }));
    const view = await renderAddStop();

    await search(view, 'Space');

    expect(view.getByTestId('place-search-error')).toBeTruthy();
    expect(
      view.getByText('Search is not available right now. Try again in a moment.')
    ).toBeTruthy();
  });

  it('uses one session token through /retrieve, then opens the place', async () => {
    const view = await renderAddStop('end');
    await search(view, 'Sp');
    await search(view, 'Space');

    await fireEvent.press(view.getByTestId('place-result-needle-suggested'));

    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    const tokens = [...requests('/suggest'), ...requests('/retrieve')].map((request) =>
      request.get('session_token')
    );
    expect(tokens).toEqual(['token-1', 'token-1', 'token-1']);

    const { pathname, params } = (router.push as jest.Mock).mock.calls[0][0] as {
      pathname: string;
      params: { id: number; place: string; stopType: string };
    };
    expect(pathname).toBe('/trips/[id]/stopDetails');
    expect(params.id).toBe(1);
    expect(params.stopType).toBe('end');
    expect(parsePlaceParam(decodeURIComponent(params.place))).toEqual({
      mapboxId: 'needle-retrieved',
      name: 'Space Needle',
      address: '400 Broad Street, Seattle',
      lat: 47.6205,
      lng: -122.3493,
      category: 'attraction',
    });
  });

  it('passes a return stop’s position on to the preview', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: '1',
      stopType: 'stop',
      atPosition: '4',
    });
    const view = await renderScreen(<AddStopScreen />, signedInAuth());
    await view.findByTestId('add-stop-map');
    await search(view, 'Space');

    await fireEvent.press(view.getByTestId('place-result-needle-suggested'));

    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect((router.push as jest.Mock).mock.calls[0][0]).toMatchObject({
      params: { stopType: 'stop', atPosition: 4 },
    });
  });

  it('passes the moving stop on to the preview after Change place', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: '1',
      stopType: 'start',
      stopId: '7',
    });
    const view = await renderScreen(<AddStopScreen />, signedInAuth());
    await view.findByTestId('add-stop-map');
    expect(view.getByPlaceholderText('Search for its new place')).toBeTruthy();
    await search(view, 'Space');

    await fireEvent.press(view.getByTestId('place-result-needle-suggested'));

    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect((router.push as jest.Mock).mock.calls[0][0]).toMatchObject({
      pathname: '/trips/[id]/stopDetails',
      params: { stopType: 'start', stopId: 7 },
    });
  });

  it('sends no position for a stop that goes in the default place', async () => {
    const view = await renderAddStop();
    await search(view, 'Space');

    await fireEvent.press(view.getByTestId('place-result-needle-suggested'));

    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    const { params } = (router.push as jest.Mock).mock.calls[0][0] as { params: object };
    expect(params).not.toHaveProperty('atPosition');
    expect(params).not.toHaveProperty('stopId');
  });

  it('stays on the results with a message when the place fails to load', async () => {
    const view = await renderAddStop();
    await search(view, 'Space');
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500 }));

    await fireEvent.press(view.getByTestId('place-result-needle-suggested'));

    expect(await view.findByTestId('place-search-error')).toBeTruthy();
    expect(view.getByText('Space Needle')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('keeps the first tap on a result while the keyboard is open', async () => {
    const view = await renderAddStop();
    await search(view, 'Space');

    expect(view.getByTestId('place-results').props.keyboardShouldPersistTaps).toBe('handled');
  });

  describe('searching along the route', () => {
    const NOW = new Date(2026, 8, 2, 9, 30).toISOString();
    const stopRow = (id: number, stop_type: string, lat: number, is_turnaround = false) => ({
      id,
      trip_id: 1,
      position: id - 1,
      name: `Stop ${id}`,
      address: null,
      lat,
      lng: -120,
      mapbox_id: null,
      stop_type,
      category: 'other',
      notes: null,
      departs_at: null,
      is_turnaround,
      created_at: NOW,
      updated_at: NOW,
    });
    // Straight south along one meridian, an hour per drive, so the time slider's middle (1 h 30 min
    // into 3 h) is halfway down the second drive, between stops 2 and 3
    const ONE_WAY = [
      stopRow(1, 'start', 47),
      stopRow(2, 'stop', 46),
      stopRow(3, 'stop', 45),
      stopRow(4, 'end', 44),
    ];
    const ROUND_TRIP = [stopRow(1, 'start', 47), stopRow(2, 'stop', 45, true)];
    const gasFeature = (id: string, lat: number) => ({
      geometry: { coordinates: [-120.1, lat] },
      properties: {
        mapbox_id: id,
        name: `Gas ${id}`,
        full_address: `${id} Main St`,
        poi_category_ids: ['gas_station', 'coffee'],
      },
    });
    const GAS = [gasFeature('g1', 45.55), gasFeature('g2', 45.45)];

    const withTrip = (stops: ReturnType<typeof stopRow>[], tripType: 'one-way' | 'round-trip') => {
      mockTable('trips').__setResult({
        data: { id: 1, name: 'Coast Run', starts_at: NOW, trip_type: tripType },
        error: null,
      });
      mockTable('trip_stops').__setResult({ data: stops, error: null });
      mockTable('trip_routes').__setResult({ data: savedRouteRow(stops, tripType), error: null });
    };

    const renderBrowse = async ({
      features = GAS as unknown[],
      stops = ONE_WAY,
      tripType = 'one-way' as 'one-way' | 'round-trip',
      params = {} as Record<string, string>,
    } = {}) => {
      withTrip(stops, tripType);
      answers([SUGGESTION], features);
      const view = await renderAddStop('stop', params);
      await view.findByTestId('route-search-panel');
      return view;
    };

    const settle = () => act(async () => void (await jest.advanceTimersByTimeAsync(0)));

    const tapChip = async (view: View, category: string) => {
      await fireEvent.press(view.getByTestId(`category-chip-${category}`));
      await settle();
    };

    // Drags through a value first, as a finger would, then lets go on the last one
    const slide = async (view: View, testID: string, ...values: number[]) => {
      for (const value of values) await fireEvent(view.getByTestId(testID), 'valueChange', value);
      await fireEvent(view.getByTestId(testID), 'slidingComplete', values.at(-1));
      await settle();
    };

    const searchPoint = (view: View) => view.getByTestId('search-point').props.coordinate;
    const latestCategoryRequest = () => requests('/category/gas_station').at(-1)!;

    const pushedParams = () =>
      (router.push as jest.Mock).mock.calls[0][0] as {
        params: { place: string; stopType: string; atPosition?: number };
      };

    it.each(['start', 'end', 'destination'])(
      'leaves the chips and panel off while setting the %s',
      async (type) => {
        withTrip(ONE_WAY.slice(0, 2), 'one-way');
        const view = await renderAddStop(type);

        expect(view.queryByTestId('category-chips')).toBeNull();
        expect(view.queryByTestId('route-search-panel')).toBeNull();
      }
    );

    it('leaves them off when moving a stop, which keeps its place in the trip', async () => {
      withTrip(ONE_WAY, 'one-way');
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        id: '1',
        stopType: 'stop',
        stopId: '2',
      });
      const view = await renderScreen(<AddStopScreen />, signedInAuth());
      await view.findByTestId('add-stop-map');

      expect(view.queryByTestId('category-chips')).toBeNull();
      expect(view.queryByTestId('route-search-panel')).toBeNull();
    });

    it('leaves them off until there’s a route to search along, while typed search still works', async () => {
      mockTable('trip_stops').__setResult({ data: ONE_WAY, error: null });
      const view = await renderAddStop('stop');
      await view.findByLabelText('Stop 1, Stop 1');

      expect(view.queryByTestId('route-search-panel')).toBeNull();
      expect(view.queryByTestId('category-chips')).toBeNull();
      await search(view, 'Space');
      expect(view.getByTestId('place-result-needle-suggested')).toBeTruthy();
    });

    it('says why there’s no route search when directions fail, and tries again on request', async () => {
      withTrip(ONE_WAY, 'one-way');
      // No saved route, so the screen asks Mapbox, which fails the first time
      mockTable('trip_routes').__setResult({ data: null, error: null });
      fetchMock.mockImplementation(async (url: string) =>
        url.includes('/directions/')
          ? { ok: false, status: 500, json: async () => ({ message: 'down' }) }
          : { ok: true, status: 200, json: async () => ({ suggestions: [SUGGESTION] }) }
      );
      const view = await renderAddStop('stop');

      expect(await view.findByTestId('route-search-error')).toHaveTextContent(
        /Directions are not available right now/
      );
      expect(view.queryByTestId('route-search-panel')).toBeNull();

      mockTable('trip_routes').__setResult({
        data: savedRouteRow(ONE_WAY, 'one-way'),
        error: null,
      });
      await fireEvent.press(view.getByLabelText('Try again'));

      expect(await view.findByTestId('route-search-panel')).toBeTruthy();
      expect(view.queryByTestId('route-search-error')).toBeNull();
    });

    it('starts halfway into the drive with a 10 mile radius, and offers no way back on a one-way trip', async () => {
      const view = await renderBrowse();

      expect(view.getByTestId('route-time-slider').props).toMatchObject({
        minimumValue: 0,
        maximumValue: 3 * 3600,
        step: 300,
        value: 5400,
      });
      expect(view.getByTestId('route-time-slider-value', HIDDEN)).toHaveTextContent(/^1 h 30 min$/);
      expect(view.getByTestId('route-time-slider').props.accessibilityValue).toEqual({
        text: '1 h 30 min',
      });
      expect(view.getByTestId('route-radius-slider-value', HIDDEN)).toHaveTextContent('10 mi');
      expect(view.queryByTestId('route-direction-return')).toBeNull();
    });

    it('marks the point that far along the route, with its search circle', async () => {
      const view = await renderBrowse();

      const [lng, lat] = searchPoint(view);
      expect(lng).toBeCloseTo(-120, 6);
      expect(lat).toBeCloseTo(45.5, 6);
      expect(view.getByTestId('search-radius')).toBeTruthy();
      expect(view.getByTestId('route-section')).toBeTruthy();
    });

    it('moves the point while the slider moves, without searching until it’s let go', async () => {
      const view = await renderBrowse();
      await tapChip(view, 'gas');
      const before = requests('/category/gas_station').length;

      await fireEvent(view.getByTestId('route-time-slider'), 'valueChange', 1800);
      await settle();

      expect(searchPoint(view)[1]).toBeCloseTo(46.5, 6);
      expect(requests('/category/gas_station')).toHaveLength(before);

      await fireEvent(view.getByTestId('route-time-slider'), 'slidingComplete', 1800);
      await settle();
      expect(requests('/category/gas_station')).toHaveLength(before + 1);
      expect(latestCategoryRequest().get('proximity')).toBe('-120,46.5');
    });

    it('searches the chip’s category around the point, as wide as the radius, with no session token', async () => {
      const view = await renderBrowse();

      await tapChip(view, 'gas');

      const request = latestCategoryRequest();
      const [west, south, east, north] = request.get('bbox')!.split(',').map(Number);
      expect(request.get('proximity')).toBe('-120,45.5');
      // 10 miles is about 0.145 degrees of latitude
      expect(north - 45.5).toBeCloseTo(0.1446, 3);
      expect(45.5 - south).toBeCloseTo(0.1446, 3);
      expect(west).toBeLessThan(-120);
      expect(east).toBeGreaterThan(-120);
      expect(request.has('session_token')).toBe(false);
    });

    it('searches a wider area when the radius slider is let go', async () => {
      const view = await renderBrowse();
      await tapChip(view, 'gas');

      await slide(view, 'route-radius-slider', 15, 20);

      expect(requests('/category/gas_station')).toHaveLength(2);
      const [, south, , north] = latestCategoryRequest().get('bbox')!.split(',').map(Number);
      expect((north - south) / 2).toBeCloseTo(0.2891, 3);
    });

    it('searches nothing until a chip is picked', async () => {
      const view = await renderBrowse();

      await slide(view, 'route-time-slider', 3600);

      expect(requests('/category/')).toHaveLength(0);
    });

    it('pins what it finds and fits the map to them and the point', async () => {
      const view = await renderBrowse();

      await tapChip(view, 'gas');

      expect(view.getByTestId('place-pin-g1')).toBeTruthy();
      expect(view.getByTestId('place-pin-g2')).toBeTruthy();
      const { bounds } = view.getByTestId('mapbox-camera').props;
      expect(bounds.ne[1]).toBeCloseTo(45.55, 6);
      expect(bounds.sw).toEqual([-120.1, 45.45]);
    });

    it('fits the map to the drive being searched, and back to it when the chip is tapped off', async () => {
      const view = await renderBrowse();
      const driveBounds = { ne: [-120, 47], sw: [-120, 44] };
      expect(view.getByTestId('mapbox-camera').props.bounds).toEqual(driveBounds);

      await tapChip(view, 'gas');
      await tapChip(view, 'gas');

      expect(view.queryByTestId('place-pin-g1')).toBeNull();
      expect(view.getByTestId('mapbox-camera').props.bounds).toEqual(driveBounds);
    });

    it('opens a tapped pin’s place, put between the stops the search looked between', async () => {
      const view = await renderBrowse();
      await tapChip(view, 'gas');

      await fireEvent.press(view.getByLabelText('Gas g1'));
      expect(view.getByTestId('place-card')).toHaveTextContent(/Gas g1.*g1 Main St/);
      await fireEvent.press(view.getByTestId('place-card-choose'));

      const { params } = pushedParams();
      expect(params.stopType).toBe('stop');
      expect(parsePlaceParam(decodeURIComponent(params.place))).toEqual({
        mapboxId: 'g1',
        name: 'Gas g1',
        address: 'g1 Main St',
        lat: 45.55,
        lng: -120.1,
        category: 'gas',
      });
      // The point is on the drive from stop 2 to stop 3, so the new stop goes between them
      expect(params.atPosition).toBe(2);
      expect(requests('/retrieve')).toHaveLength(0);
    });

    it('places a stop found earlier in the drive earlier in the trip', async () => {
      // Half an hour in is halfway down the first drive, at latitude 46.5
      const view = await renderBrowse({ features: [gasFeature('g1', 46.55)] });
      await slide(view, 'route-time-slider', 1800);

      await tapChip(view, 'gas');
      await fireEvent.press(view.getByLabelText('Gas g1'));
      await fireEvent.press(view.getByTestId('place-card-choose'));

      expect(pushedParams().params.atPosition).toBe(1);
    });

    it('leaves a typed search’s stop where the planner opened search', async () => {
      const view = await renderBrowse();
      await slide(view, 'route-time-slider', 1800);

      await search(view, 'Space');
      await fireEvent.press(view.getByTestId('place-result-needle-suggested'));

      await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
      expect(pushedParams().params).not.toHaveProperty('atPosition');
    });

    it('never shows typed and map search at once: typing clears the chip and its pins', async () => {
      const view = await renderBrowse();
      await tapChip(view, 'gas');

      await search(view, 'Space');

      expect(view.queryByTestId('category-chips')).toBeNull();
      expect(view.queryByTestId('route-search-panel')).toBeNull();
      expect(view.queryByTestId('place-pin-g1')).toBeNull();
      await fireEvent.press(view.getByLabelText('Close search'));
      expect(view.getByTestId('category-chip-gas').props.accessibilityState.selected).toBe(false);
    });

    it('says so when there is nothing of that kind there', async () => {
      const view = await renderBrowse({ features: [] });

      await tapChip(view, 'rest');

      expect(
        view.getByText('Nothing found here. Try another time or a wider radius.')
      ).toBeTruthy();
    });

    it('shows a friendly message when the search fails', async () => {
      const view = await renderBrowse();
      fetchMock.mockImplementation(async () => ({ ok: false, status: 500 }));

      await tapChip(view, 'gas');

      expect(view.getByTestId('place-search-error')).toHaveTextContent(
        'Search is not available right now. Try again in a moment.'
      );
    });

    it('lets the Android back button close the place, then the chip, before leaving', async () => {
      const listen = jest.spyOn(BackHandler, 'addEventListener');
      const view = await renderBrowse();
      await tapChip(view, 'gas');
      await fireEvent.press(view.getByLabelText('Gas g1'));
      const pressBack = () => act(async () => void listen.mock.calls.at(-1)![1]());

      await pressBack();
      expect(view.queryByTestId('place-card')).toBeNull();
      expect(view.getByTestId('place-pin-g1')).toBeTruthy();

      await pressBack();
      expect(view.queryByTestId('place-pin-g1')).toBeNull();
      expect(router.back).not.toHaveBeenCalled();
    });

    it('puts the chips in the panel, under the sliders', async () => {
      const view = await renderBrowse();

      expect(view.getByTestId('route-search-panel')).toContainElement(
        view.getByTestId('category-chips')
      );
    });

    it('keeps the drive clear of the search bar at the top and the panel at the bottom', async () => {
      const view = await renderBrowse();

      await fireEvent(view.getByTestId('route-search-panel'), 'layout', {
        nativeEvent: { layout: { height: 220 } },
      });

      // The panel reaches the bottom edge, so its measured height already holds the test screen's
      // 34-point home indicator. The top has the 47-point status bar
      const { padding } = view.getByTestId('mapbox-camera').props;
      expect(padding.paddingTop).toBe(100 + 47 + 10 + 52);
      expect(padding.paddingBottom).toBe(100 + 220);
    });

    it('puts the show all stops button right above the panel', async () => {
      const view = await renderBrowse();

      const button = view.getByTestId('show-all-stops');
      expect(StyleSheet.flatten(button.props.style).marginBottom).toBe(0);
    });

    it('keeps a tapped place’s card under the show all stops button, not over it', async () => {
      const view = await renderBrowse();
      await tapChip(view, 'gas');
      await fireEvent.press(view.getByLabelText('Gas g1'));

      const button = view.getByTestId('show-all-stops');
      expect(StyleSheet.flatten(button.props.style).marginBottom).toBe(spacing.sm);
      // Rendered before the card, so the card is the lowest thing in the area above the panel
      const ids = view
        .getAllByTestId(/^(place-card|show-all-stops)$/)
        .map((element) => element.props.testID);
      expect(ids).toEqual(['show-all-stops', 'place-card']);
    });

    it('runs the panel to the bottom edge, with its controls above the home indicator', async () => {
      const view = await renderBrowse();

      const panel = StyleSheet.flatten(view.getByTestId('route-search-panel').props.style);
      expect(panel.paddingBottom).toBe(15 + 34);
      expect(panel.marginHorizontal ?? 0).toBe(0);
      expect(panel.borderBottomLeftRadius ?? 0).toBe(0);
    });

    it('asks Mapbox for the square around the circle, then drops what’s in its corners', async () => {
      // At latitude 45.5, 10 miles is about 0.145 degrees north and 0.206 east. This one is inside
      // the square in both, but about 20 km from the point
      const corner = {
        geometry: { coordinates: [-120 + 0.18, 45.5 + 0.13] },
        properties: { mapbox_id: 'corner', name: 'Gas corner', poi_category_ids: ['gas_station'] },
      };
      const view = await renderBrowse({ features: [...GAS, corner] });

      await tapChip(view, 'gas');

      expect(view.getByTestId('place-pin-g1')).toBeTruthy();
      expect(view.getByTestId('place-pin-g2')).toBeTruthy();
      expect(view.queryByTestId('place-pin-corner')).toBeNull();
      const { bounds } = view.getByTestId('mapbox-camera').props;
      expect(bounds.ne[0]).toBeLessThan(-119.9);
    });

    it('says nothing was found when everything it got was outside the circle', async () => {
      const corner = {
        geometry: { coordinates: [-120 + 0.18, 45.5 + 0.13] },
        properties: { mapbox_id: 'corner', name: 'Gas corner', poi_category_ids: ['gas_station'] },
      };
      const view = await renderBrowse({ features: [corner] });

      await tapChip(view, 'gas');

      expect(view.queryByTestId('place-pin-corner')).toBeNull();
      expect(
        view.getByText('Nothing found here. Try another time or a wider radius.')
      ).toBeTruthy();
    });

    it('keeps a place the wider radius reaches', async () => {
      const corner = {
        geometry: { coordinates: [-120 + 0.18, 45.5 + 0.13] },
        properties: { mapbox_id: 'corner', name: 'Gas corner', poi_category_ids: ['gas_station'] },
      };
      const view = await renderBrowse({ features: [corner] });
      await tapChip(view, 'gas');

      await slide(view, 'route-radius-slider', 15);

      expect(view.getByTestId('place-pin-corner')).toBeTruthy();
    });

    describe('on a round trip', () => {
      // Out to the destination (stop 2), then a stop on the drive home (stop 3), then the start
      const WITH_RETURN_STOP = [...ROUND_TRIP, stopRow(3, 'stop', 46)];
      const pinned = (view: View) =>
        view.getAllByTestId(/^map-pin-/).map((pin) => pin.props.testID as string);

      it('pins only the stops on the way there, then only those on the way home', async () => {
        const view = await renderBrowse({ stops: WITH_RETURN_STOP, tripType: 'round-trip' });

        expect(pinned(view)).toEqual(['map-pin-1', 'map-pin-2']);

        await fireEvent.press(view.getByTestId('route-direction-return'));
        await settle();

        // The drive home ends back at the start, so it's pinned too, still numbered 1
        expect(pinned(view)).toEqual(['map-pin-1', 'map-pin-2', 'map-pin-3']);
        expect(view.getByLabelText('Stop 3, Stop 3')).toHaveTextContent('3');
      });

      it('searches the whole trip from Full trip, with every stop pinned', async () => {
        const view = await renderBrowse({
          stops: WITH_RETURN_STOP,
          tripType: 'round-trip',
          features: [gasFeature('g1', 45.55)],
        });

        await fireEvent.press(view.getByTestId('route-direction-full'));
        await settle();

        expect(pinned(view)).toEqual(['map-pin-1', 'map-pin-2', 'map-pin-3']);
        // Three one-hour drives: out, to the stop on the way home, then home
        expect(view.getByTestId('route-time-slider').props).toMatchObject({
          maximumValue: 3 * 3600,
          value: 5400,
          accessibilityLabel: 'Time into the trip',
        });
        // An hour and a half in is halfway through the second drive, from the destination at 45
        // to the stop on the way home at 46
        expect(searchPoint(view)[1]).toBeCloseTo(45.5, 6);

        await tapChip(view, 'gas');
        await fireEvent.press(view.getByLabelText('Gas g1'));
        await fireEvent.press(view.getByTestId('place-card-choose'));
        expect(pushedParams().params.atPosition).toBe(2);
      });

      it('chooses between the way to the destination and the way back', async () => {
        const view = await renderBrowse({ stops: ROUND_TRIP, tripType: 'round-trip' });

        expect(view.getByTestId('route-direction-outbound').props.accessibilityState.selected).toBe(
          true
        );
        expect(view.getByTestId('route-time-slider').props.accessibilityLabel).toBe(
          'Time into the drive'
        );

        await fireEvent.press(view.getByTestId('route-direction-return'));
        await settle();

        expect(view.getByTestId('route-direction-return').props.accessibilityState.selected).toBe(
          true
        );
        expect(view.getByTestId('route-time-slider').props.accessibilityLabel).toBe(
          'Time into the drive home'
        );
      });

      it('opens on the way back when the planner asked for a return stop', async () => {
        const view = await renderBrowse({
          stops: ROUND_TRIP,
          tripType: 'round-trip',
          features: [gasFeature('g1', 46.05)],
          params: { atPosition: '2' },
        });

        expect(view.getByTestId('route-direction-return').props.accessibilityState.selected).toBe(
          true
        );
        expect(view.getByTestId('route-time-slider').props.accessibilityLabel).toBe(
          'Time into the drive home'
        );
        expect(searchPoint(view)[1]).toBeCloseTo(46, 6);

        await tapChip(view, 'gas');
        await fireEvent.press(view.getByLabelText('Gas g1'));
        await fireEvent.press(view.getByTestId('place-card-choose'));
        expect(pushedParams().params.atPosition).toBe(2);
      });

      it('starts the way back halfway home, with the time from leaving the destination', async () => {
        const view = await renderBrowse({ stops: ROUND_TRIP, tripType: 'round-trip' });
        await slide(view, 'route-time-slider', 900);

        await fireEvent.press(view.getByTestId('route-direction-return'));
        await settle();

        expect(view.getByTestId('route-time-slider').props).toMatchObject({
          maximumValue: 3600,
          value: 1800,
        });
        expect(searchPoint(view)[1]).toBeCloseTo(46, 6);
      });

      it('searches again on the way back, and puts what it finds after the destination', async () => {
        const view = await renderBrowse({
          stops: ROUND_TRIP,
          tripType: 'round-trip',
          features: [gasFeature('g1', 46.05)],
        });
        await tapChip(view, 'gas');

        // Halfway home is the same spot as halfway there on this road, but it still searches again
        await fireEvent.press(view.getByTestId('route-direction-return'));
        await settle();

        expect(requests('/category/gas_station')).toHaveLength(2);
        expect(latestCategoryRequest().get('proximity')).toBe('-120,46');
        await fireEvent.press(view.getByLabelText('Gas g1'));
        await fireEvent.press(view.getByTestId('place-card-choose'));
        expect(pushedParams().params.atPosition).toBe(2);
      });
    });
  });

  describe('the show all stops button', () => {
    const setCamera = (Mapbox as unknown as { __camera: { setCamera: jest.Mock } }).__camera
      .setCamera;
    const NOW = new Date(2026, 8, 2, 9, 30).toISOString();
    const stopRow = (id: number, stop_type: string, lat: number) => ({
      id,
      trip_id: 1,
      position: id - 1,
      name: `Stop ${id}`,
      address: null,
      lat,
      lng: -120,
      mapbox_id: null,
      stop_type,
      category: 'other',
      notes: null,
      departs_at: null,
      is_turnaround: false,
      created_at: NOW,
      updated_at: NOW,
    });
    const STOPS = [stopRow(1, 'start', 47), stopRow(2, 'stop', 46), stopRow(3, 'end', 45)];

    const renderWithStops = async (data: unknown[] = STOPS) => {
      mockTable('trip_stops').__setResult({ data, error: null });
      const view = await renderAddStop('stop');
      await view.findByTestId('add-stop-map');
      return view;
    };

    it('flies the camera back to every stop, even after the user panned away', async () => {
      const view = await renderWithStops();

      await fireEvent.press(view.getByLabelText('Show all stops'));

      expect(setCamera).toHaveBeenCalledTimes(1);
      expect(setCamera.mock.calls[0][0]).toMatchObject({
        bounds: { ne: [-120, 47], sw: [-120, 45] },
        animationMode: 'easeTo',
      });
    });

    it('moves the camera off a category search’s results back to the stops, keeping the pins', async () => {
      const gas = {
        geometry: { coordinates: [-120.05, 46.05] },
        properties: { mapbox_id: 'g1', name: 'Gas g1', poi_category_ids: ['gas_station'] },
      };
      answers([SUGGESTION], [gas]);
      mockTable('trips').__setResult({
        data: { id: 1, name: 'Coast Run', starts_at: NOW, trip_type: 'one-way' },
        error: null,
      });
      mockTable('trip_routes').__setResult({ data: savedRouteRow(STOPS, 'one-way'), error: null });
      const view = await renderWithStops();
      await view.findByTestId('route-search-panel');
      await fireEvent.press(view.getByTestId('category-chip-gas'));
      await act(async () => void (await jest.advanceTimersByTimeAsync(0)));

      await fireEvent.press(view.getByLabelText('Show all stops'));

      expect(view.getByTestId('mapbox-camera').props.bounds).toEqual({
        ne: [-120, 47],
        sw: [-120, 45],
      });
      expect(view.getByTestId('place-pin-g1')).toBeTruthy();
    });

    it('isn’t offered before the trip has a stop to show', async () => {
      const view = await renderWithStops([]);

      expect(view.queryByLabelText('Show all stops')).toBeNull();
    });

    it('hides while typed search covers the map', async () => {
      const view = await renderWithStops();

      await search(view, 'Space');

      expect(view.queryByLabelText('Show all stops')).toBeNull();
    });
  });
});
