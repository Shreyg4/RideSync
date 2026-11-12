// Runs the real hook and service with only fetch faked, so these check the requests that actually
// reach Mapbox as well as what the screen does with the answers.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { BackHandler } from 'react-native';
import * as Mapbox from '@rnmapbox/maps';
import AddStopScreen from '../trips/[id]/addStop';
import { parsePlaceParam } from '@/src/lib/placeParam';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockTable } from '@/src/test/supabase';

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

const withStopType = (stopType?: string) =>
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: '1', stopType });

const renderAddStop = async (stopType = 'stop') => {
  withStopType(stopType);
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
      // Adding a normal stop also has the From picker and chips under it, 90 points more
      const { padding } = view.getByTestId('mapbox-camera').props;
      expect(padding.paddingTop).toBe(100 + 47 + 10 + 52 + 90);
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

  describe('searching the map by kind of place', () => {
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
    // A one-way trip, so a new stop goes after stop 3 unless the user picks another
    const ONE_WAY = [
      stopRow(1, 'start', 47),
      stopRow(2, 'stop', 46),
      stopRow(3, 'stop', 45),
      stopRow(4, 'end', 44),
    ];
    const gasFeature = (id: string, lat: number) => ({
      geometry: { coordinates: [-120.1, lat] },
      properties: {
        mapbox_id: id,
        name: `Gas ${id}`,
        full_address: `${id} Main St`,
        poi_category_ids: ['gas_station', 'coffee'],
      },
    });
    const GAS = [gasFeature('g1', 45.05), gasFeature('g2', 44.95)];

    const renderBrowse = async (features: unknown[] = GAS) => {
      mockTable('trip_stops').__setResult({ data: ONE_WAY, error: null });
      answers([SUGGESTION], features);
      const view = await renderAddStop('stop');
      await view.findByLabelText('Stop 1, Stop 1');
      return view;
    };

    const tapChip = async (view: View, category: string) => {
      await fireEvent.press(view.getByTestId(`category-chip-${category}`));
      await act(async () => void (await jest.advanceTimersByTimeAsync(0)));
    };

    const userMovesMap = async (view: View) => {
      const map = () => view.getByTestId('add-stop-map');
      const state = (isGestureActive: boolean) => ({
        properties: { center: [-119.5, 43.5], bounds: { ne: [-119, 44], sw: [-120, 43] } },
        gestures: { isGestureActive },
      });
      await act(async () => map().props.onCameraChanged(state(true)));
      await act(async () => map().props.onMapIdle(state(false)));
    };

    const pushedParams = () =>
      (router.push as jest.Mock).mock.calls[0][0] as {
        params: { place: string; stopType: string; atPosition?: number };
      };

    it.each(['start', 'end', 'destination'])(
      'leaves the From stop and chips off while setting the %s',
      async (type) => {
        mockTable('trip_stops').__setResult({ data: ONE_WAY.slice(0, 1), error: null });
        const view = await renderAddStop(type);

        expect(view.queryByTestId('map-search-controls')).toBeNull();
      }
    );

    it('leaves them off when moving a stop, which keeps its place in the trip', async () => {
      mockTable('trip_stops').__setResult({ data: ONE_WAY, error: null });
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        id: '1',
        stopType: 'stop',
        stopId: '2',
      });
      const view = await renderScreen(<AddStopScreen />, signedInAuth());
      await view.findByTestId('add-stop-map');

      expect(view.queryByTestId('map-search-controls')).toBeNull();
    });

    it('searches from the stop before the end, where a new stop goes by default', async () => {
      const view = await renderBrowse();

      expect(view.getByTestId('from-stop-picker')).toHaveTextContent('From3 · Stop 3');
    });

    it('offers every stop but the end to search from', async () => {
      const view = await renderBrowse();

      await fireEvent.press(view.getByTestId('from-stop-picker'));

      expect(view.getByTestId('from-stop-1')).toBeTruthy();
      expect(view.getByTestId('from-stop-3')).toBeTruthy();
      expect(view.queryByTestId('from-stop-4')).toBeNull();
    });

    it('searches the chip’s category around the From stop, with no session token', async () => {
      const view = await renderBrowse();

      await tapChip(view, 'gas');

      const [request] = requests('/category/gas_station');
      const [west, south, east, north] = request.get('bbox')!.split(',').map(Number);
      expect(request.get('proximity')).toBe('-120,45');
      expect(west).toBeLessThan(-120);
      expect(east).toBeGreaterThan(-120);
      expect(south).toBeLessThan(45);
      expect(north).toBeGreaterThan(45);
      expect(request.has('session_token')).toBe(false);
    });

    it('pins what it finds and fits the map to them and the From stop', async () => {
      const view = await renderBrowse();

      await tapChip(view, 'gas');

      expect(view.getByTestId('place-pin-g1')).toBeTruthy();
      expect(view.getByTestId('place-pin-g2')).toBeTruthy();
      expect(view.getByTestId('mapbox-camera').props.bounds).toEqual({
        ne: [-120, 45.05],
        sw: [-120.1, 44.95],
      });
    });

    it('clears the pins and shows the whole trip again when the chip is tapped off', async () => {
      const view = await renderBrowse();
      await tapChip(view, 'gas');

      await tapChip(view, 'gas');

      expect(view.queryByTestId('place-pin-g1')).toBeNull();
      expect(view.getByTestId('mapbox-camera').props.bounds).toEqual({
        ne: [-120, 47],
        sw: [-120, 44],
      });
    });

    it('shows a tapped pin’s place, then opens it as the chip’s kind of stop', async () => {
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
        lat: 45.05,
        lng: -120.1,
        category: 'gas',
      });
      // The default From, so add_trip_stop picks the place itself
      expect(params).not.toHaveProperty('atPosition');
      expect(requests('/retrieve')).toHaveLength(0);
    });

    it('adds the stop right after a From stop the user picks, and searches around it', async () => {
      const view = await renderBrowse();
      await tapChip(view, 'gas');

      await fireEvent.press(view.getByTestId('from-stop-picker'));
      await fireEvent.press(view.getByTestId('from-stop-1'));
      await act(async () => void (await jest.advanceTimersByTimeAsync(0)));

      expect(requests('/category/gas_station')[1].get('proximity')).toBe('-120,47');
      await fireEvent.press(view.getByLabelText('Gas g1'));
      await fireEvent.press(view.getByTestId('place-card-choose'));
      expect(pushedParams().params.atPosition).toBe(1);
    });

    it('also puts a typed search’s stop after the picked From stop', async () => {
      const view = await renderBrowse();
      await fireEvent.press(view.getByTestId('from-stop-picker'));
      await fireEvent.press(view.getByTestId('from-stop-2'));

      await search(view, 'Space');
      await fireEvent.press(view.getByTestId('place-result-needle-suggested'));

      await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
      expect(pushedParams().params.atPosition).toBe(2);
    });

    it('never shows typed and map search at once: typing clears the chip and its pins', async () => {
      const view = await renderBrowse();
      await tapChip(view, 'gas');

      await search(view, 'Space');

      expect(view.queryByTestId('category-chips')).toBeNull();
      expect(view.queryByTestId('place-pin-g1')).toBeNull();
      await fireEvent.press(view.getByLabelText('Close search'));
      expect(view.getByTestId('category-chip-gas').props.accessibilityState.selected).toBe(false);
    });

    it('offers to search where the user moved the map, and leaves the map there', async () => {
      const view = await renderBrowse();
      await tapChip(view, 'gas');
      expect(view.queryByTestId('search-this-area')).toBeNull();
      const cameraBefore = view.getByTestId('mapbox-camera').props.bounds;

      await userMovesMap(view);
      await fireEvent.press(view.getByTestId('search-this-area'));
      await act(async () => void (await jest.advanceTimersByTimeAsync(0)));

      const latest = requests('/category/gas_station').at(-1)!;
      expect(latest.get('bbox')).toBe('-120,43,-119,44');
      expect(latest.get('proximity')).toBe('-119.5,43.5');
      expect(view.queryByTestId('search-this-area')).toBeNull();
      expect(view.getByTestId('mapbox-camera').props.bounds).toEqual(cameraBefore);
    });

    it('doesn’t watch the map move before a chip is picked', async () => {
      const view = await renderBrowse();

      expect(view.getByTestId('add-stop-map').props.onMapIdle).toBeUndefined();
      expect(view.queryByTestId('search-this-area')).toBeNull();
    });

    it('says so when there is nothing of that kind nearby', async () => {
      const view = await renderBrowse([]);

      await tapChip(view, 'rest');

      expect(
        view.getByText('Nothing found here. Move the map to look somewhere else.')
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
        geometry: { coordinates: [-121, 46.5] },
        properties: { mapbox_id: 'g1', name: 'Gas g1', poi_category_ids: ['gas_station'] },
      };
      answers([SUGGESTION], [gas]);
      const view = await renderWithStops();
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
