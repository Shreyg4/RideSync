// The full-screen map a planner's map opens: it shows the trip's stops, opens one from its pin, and
// follows stop changes made on other phones

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import * as Mapbox from '@rnmapbox/maps';
import TripMapScreen from '../trips/[id]/map';
import { savedRouteRow } from '@/src/test/route';
import type { TripStopRow } from '@/src/services/tripStopService';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockChannels, mockTable } from '@/src/test/supabase';

const NOW = new Date(2026, 8, 2, 9, 30).toISOString();

const stopRow = (id: number, stop_type: string, name: string, lat = 47.6): TripStopRow => ({
  id,
  trip_id: 1,
  position: id - 1,
  name,
  address: null,
  lat,
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

const renderMap = async (stops: TripStopRow[]) => {
  mockTable('trip_stops').__setResult({ data: stops, error: null });
  const view = await renderScreen(<TripMapScreen />, signedInAuth());
  return view;
};

beforeEach(() => {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: '1' });
  (router.push as jest.Mock).mockClear();
  (router.back as jest.Mock).mockClear();
});

describe('TripMapScreen', () => {
  it('shows this trip’s stops, numbered in trip order', async () => {
    const view = await renderMap([stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast', 45.5)]);

    expect(await view.findByLabelText('Stop 1, Home')).toHaveTextContent('1');
    expect(view.getByLabelText('Stop 2, Coast')).toHaveTextContent('2');
    expect(mockTable('trip_stops').eq).toHaveBeenCalledWith('trip_id', 1);
  });

  it('opens a stop from its pin', async () => {
    const view = await renderMap([stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast', 45.5)]);

    await fireEvent.press(await view.findByLabelText('Stop 2, Coast'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/trips/[id]/stopDetails',
      params: { id: 1, stopId: 2 },
    });
  });

  // The test screen has a 47 pt top inset and a 34 pt home indicator
  it('keeps the stops clear of the notch, back button and home indicator, with room around them', async () => {
    const view = await renderMap([stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast', 45.5)]);

    expect(view.getByTestId('mapbox-camera').props.padding).toEqual({
      paddingTop: 80 + 47 + 10 + 48,
      paddingRight: 80,
      paddingBottom: 80 + 34,
      paddingLeft: 80,
    });
  });

  it('goes back to the planner from its back button', async () => {
    const view = await renderMap([stopRow(1, 'start', 'Home')]);
    await view.findByTestId('trip-map');

    await fireEvent.press(view.getByLabelText('Go back'));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('shows a stop added on another phone', async () => {
    const view = await renderMap([stopRow(1, 'start', 'Home')]);
    await view.findByLabelText('Stop 1, Home');

    mockTable('trip_stops').__setResult({
      data: [stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast', 45.5)],
      error: null,
    });
    const channel = mockChannels().find(({ topic }) => topic.startsWith('trip-stops:'));
    await act(async () =>
      channel?.__emit({ eventType: 'INSERT', new: { id: 2, trip_id: 1 }, old: {} })
    );

    expect(await view.findByLabelText('Stop 2, Coast')).toBeTruthy();
  });

  it('shows a friendly error when the stops fail to load', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockTable('trip_stops').__setResult({ data: null, error: { code: '42501' } });
    const view = await renderScreen(<TripMapScreen />, signedInAuth());

    expect(await view.findByText("Couldn't load the map")).toBeTruthy();
    expect(view.getByText('You do not have permission to do that.')).toBeTruthy();
    expect(view.getByLabelText('Go back')).toBeTruthy();
  });

  describe('recentering', () => {
    const setCamera = (Mapbox as unknown as { __camera: { setCamera: jest.Mock } }).__camera
      .setCamera;

    it('flies back to every stop after the user pans away', async () => {
      setCamera.mockClear();
      const view = await renderMap([stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast', 45.5)]);

      await fireEvent.press(await view.findByLabelText('Recenter map'));

      expect(setCamera).toHaveBeenCalledTimes(1);
      expect(setCamera.mock.calls[0][0]).toMatchObject({
        bounds: { ne: [-122.3, 47.6], sw: [-122.3, 45.5] },
        animationMode: 'easeTo',
      });
    });

    it('sits above the home indicator when there is no sheet', async () => {
      const view = await renderMap([stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast', 45.5)]);

      const button = await view.findByTestId('recenter-map');
      expect(StyleSheet.flatten(button.props.style).bottom).toBe(34 + 10);
    });

    it('isn’t offered before the trip has a stop', async () => {
      const view = await renderMap([]);
      await view.findByTestId('trip-map');

      expect(view.queryByTestId('recenter-map')).toBeNull();
    });
  });

  describe('a round trip’s way there and way back', () => {
    // Out to the destination (stop 2), a stop on the drive home (stop 3), then back to the start
    const STOPS = [
      stopRow(1, 'start', 'Home', 47),
      { ...stopRow(2, 'stop', 'Coast', 45), is_turnaround: true },
      stopRow(3, 'stop', 'Diner', 46),
    ];
    const pinned = (view: Awaited<ReturnType<typeof renderMap>>) =>
      view.getAllByTestId(/^map-pin-/).map((pin) => pin.props.testID as string);

    const renderRoundTrip = async () => {
      mockTable('trips').__setResult({
        data: { id: 1, name: 'Coast Run', starts_at: NOW, trip_type: 'round-trip' },
        error: null,
      });
      mockTable('trip_routes').__setResult({
        data: savedRouteRow(STOPS, 'round-trip'),
        error: null,
      });
      const view = await renderMap(STOPS);
      await view.findByTestId('map-direction-sheet');
      return view;
    };

    it('opens on the full trip, with every stop and no part of the route picked out', async () => {
      const view = await renderRoundTrip();

      expect(pinned(view)).toEqual(['map-pin-1', 'map-pin-2', 'map-pin-3']);
      expect(view.queryByTestId('route-section')).toBeNull();
      const selected = (id: string) =>
        view.getByTestId(`route-direction-${id}`).props.accessibilityState.selected;
      expect(selected('full')).toBe(true);
      expect(selected('outbound')).toBe(false);
      expect(selected('return')).toBe(false);
    });

    it('shows only the way there, fitted to it, when it’s picked', async () => {
      const view = await renderRoundTrip();

      await fireEvent.press(view.getByTestId('route-direction-outbound'));

      expect(pinned(view)).toEqual(['map-pin-1', 'map-pin-2']);
      expect(view.getByTestId('route-section')).toBeTruthy();
      expect(view.getByTestId('mapbox-camera').props.bounds).toEqual({
        ne: [-122.3, 47],
        sw: [-122.3, 45],
      });
    });

    it('shows only the way home, ending back at the start, with each stop’s trip number', async () => {
      const view = await renderRoundTrip();

      await fireEvent.press(view.getByTestId('route-direction-return'));

      expect(pinned(view)).toEqual(['map-pin-1', 'map-pin-2', 'map-pin-3']);
      expect(view.getByLabelText('Stop 3, Diner')).toHaveTextContent('3');
      expect(view.getByTestId('route-section')).toBeTruthy();
    });

    it('goes back to every stop from Full trip', async () => {
      const view = await renderRoundTrip();
      await fireEvent.press(view.getByTestId('route-direction-return'));

      await fireEvent.press(view.getByTestId('route-direction-full'));

      expect(view.queryByTestId('route-section')).toBeNull();
      expect(pinned(view)).toHaveLength(3);
      expect(view.getByTestId('mapbox-camera').props.bounds).toEqual({
        ne: [-122.3, 47],
        sw: [-122.3, 45],
      });
    });

    it('keeps a picked way when it’s tapped again', async () => {
      const view = await renderRoundTrip();
      await fireEvent.press(view.getByTestId('route-direction-outbound'));

      await fireEvent.press(view.getByTestId('route-direction-outbound'));

      expect(view.getByTestId('route-section')).toBeTruthy();
      expect(pinned(view)).toEqual(['map-pin-1', 'map-pin-2']);
    });

    it('recenters on the way picked, not the whole trip', async () => {
      const setCamera = (Mapbox as unknown as { __camera: { setCamera: jest.Mock } }).__camera
        .setCamera;
      setCamera.mockClear();
      const view = await renderRoundTrip();
      await fireEvent.press(view.getByTestId('route-direction-outbound'));

      await fireEvent.press(view.getByLabelText('Recenter map'));

      expect(setCamera.mock.calls.at(-1)?.[0]).toMatchObject({
        bounds: { ne: [-122.3, 47], sw: [-122.3, 45] },
      });
    });

    it('runs the sheet to the bottom edge, keeping the stops and the button above it', async () => {
      const view = await renderRoundTrip();

      await fireEvent(view.getByTestId('map-direction-sheet'), 'layout', {
        nativeEvent: { layout: { height: 90 } },
      });

      const sheet = StyleSheet.flatten(view.getByTestId('map-direction-sheet').props.style);
      expect(sheet.paddingBottom).toBe(15 + 34);
      expect(view.getByTestId('mapbox-camera').props.padding.paddingBottom).toBe(80 + 90);
      const button = StyleSheet.flatten(view.getByTestId('recenter-map').props.style);
      expect(button.bottom).toBe(90 + 10);
    });

    it('has no sheet on a one-way trip', async () => {
      const stops = [stopRow(1, 'start', 'Home', 47), stopRow(2, 'end', 'Coast', 45)];
      mockTable('trips').__setResult({
        data: { id: 1, name: 'Coast Run', starts_at: NOW, trip_type: 'one-way' },
        error: null,
      });
      mockTable('trip_routes').__setResult({ data: savedRouteRow(stops, 'one-way'), error: null });
      const view = await renderMap(stops);
      await view.findByTestId('mapbox-shape');

      expect(view.queryByTestId('map-direction-sheet')).toBeNull();
      expect(view.queryByTestId('route-direction-outbound')).toBeNull();
    });
  });
});
