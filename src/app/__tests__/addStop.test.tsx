// Runs the real hook and service with only fetch faked, so these check the requests that actually
// reach Mapbox as well as what the screen does with the answers.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { BackHandler } from 'react-native';
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

      // The bar ends below the test's 47-point status bar, a 10-point gap and its own 52 points
      const { padding } = view.getByTestId('mapbox-camera').props;
      expect(padding.paddingTop).toBe(100 + 47 + 10 + 52);
      expect(padding.paddingBottom).toBe(100);
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
});
