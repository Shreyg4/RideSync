// The full-screen map a planner's map opens: it shows the trip's stops, opens one from its pin, and
// follows stop changes made on other phones

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import TripMapScreen from '../trips/[id]/map';
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
});
