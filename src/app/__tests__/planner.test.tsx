// The planner shows the trip's real stops, and its add button depends on the member's role and on
// which stops already exist, so these check both

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import PlannerScreen from '../trips/[id]/planner';
import type { AuthContextType } from '@/src/context/AuthProvider';
import type { TripRow } from '@/src/services/tripService';
import type { TripStopRow } from '@/src/services/tripStopService';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockChannels, mockRpc, mockTable } from '@/src/test/supabase';

const NOW = new Date(2026, 8, 2, 9, 30).toISOString();

const tripRow = (overrides: Partial<TripRow> = {}): TripRow => ({
  created_at: NOW,
  id: 1,
  image_url: null,
  invite_link: 'ABCD2345',
  name: 'Coast Run',
  owner_id: 'user-1',
  starts_at: NOW,
  trip_status: 'planning',
  trip_type: 'one-way',
  updated_at: NOW,
  ...overrides,
});

const stopRow = (id: number, stop_type: string, name: string): TripStopRow => ({
  id,
  trip_id: 1,
  position: id - 1,
  name,
  address: `${name} address`,
  lat: 47.6,
  lng: -122.3,
  mapbox_id: `mapbox-${id}`,
  stop_type,
  category: 'food',
  notes: null,
  departs_at: null,
  created_at: NOW,
  updated_at: NOW,
});

const member = (role: string) => ({
  user_id: 'user-1',
  display_name: 'Ana',
  role,
  avatar_path: '',
  joined_at: NOW,
});

const renderPlanner = async ({
  role = 'owner',
  stops = [] as TripStopRow[],
  trip = tripRow() as TripRow | null,
} = {}) => {
  mockTable('trips').__setResult({ data: trip, error: null });
  mockTable('trip_stops').__setResult({ data: stops, error: null });
  mockRpc('list_trip_members', { data: [member(role)] });
  return renderScreen(
    <PlannerScreen />,
    signedInAuth({ user: { id: 'user-1' } as AuthContextType['user'] })
  );
};

beforeEach(() => {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: '1' });
  (router.push as jest.Mock).mockClear();
});

describe('PlannerScreen', () => {
  it('lists this trip’s stops in the order the database returns', async () => {
    const view = await renderPlanner({
      stops: [stopRow(1, 'start', 'Home'), stopRow(2, 'stop', 'Diner'), stopRow(3, 'end', 'Coast')],
    });

    await view.findByText('Home');
    expect(mockTable('trip_stops').eq).toHaveBeenCalledWith('trip_id', 1);
    expect(mockTable('trip_stops').order).toHaveBeenCalledWith('position');
    const ids = view.getAllByTestId(/^stop-/).map((row) => row.props.testID);
    expect(ids).toEqual(['stop-1', 'stop-2', 'stop-3']);
  });

  it('shows no sample stops when the trip has none', async () => {
    const view = await renderPlanner();

    expect(await view.findByText('No stops yet')).toBeTruthy();
    expect(view.queryByText('Marriot')).toBeNull();
    expect(view.queryByTestId(/^stop-/)).toBeNull();
  });

  it.each(['owner', 'editor'])('lets an %s add stops', async (role) => {
    const view = await renderPlanner({ role });

    await fireEvent.press(await view.findByLabelText('Set start'));

    expect(router.push).toHaveBeenCalledWith('/trips/1/addStop');
  });

  it('gives a viewer no add button', async () => {
    const view = await renderPlanner({ role: 'viewer', stops: [stopRow(1, 'start', 'Home')] });

    await view.findByText('Home');
    expect(view.queryByLabelText('Add stop')).toBeNull();
    expect(view.queryByLabelText('Set end')).toBeNull();
    expect(view.queryByLabelText('Set start')).toBeNull();
  });

  it('tells a viewer who can add stops when there are none', async () => {
    const view = await renderPlanner({ role: 'viewer' });

    expect(await view.findByText('The owner or an editor can add stops.')).toBeTruthy();
  });

  it('gives no add button to someone not listed as a member', async () => {
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockTable('trip_stops').__setResult({ data: [stopRow(1, 'start', 'Home')], error: null });
    mockRpc('list_trip_members', { data: [] });
    const view = await renderScreen(
      <PlannerScreen />,
      signedInAuth({ user: { id: 'user-1' } as AuthContextType['user'] })
    );

    await view.findByText('Home');
    expect(view.queryByLabelText('Set end')).toBeNull();
  });

  it.each([
    ['one-way', [] as TripStopRow[], 'Set start'],
    ['one-way', [stopRow(1, 'start', 'Home')], 'Set end'],
    ['one-way', [stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast')], 'Add stop'],
    ['round-trip', [] as TripStopRow[], 'Set start'],
    ['round-trip', [stopRow(1, 'start', 'Home')], 'Add stop'],
  ])('on a %s trip with these stops, the button reads correctly', async (type, stops, label) => {
    const view = await renderPlanner({ stops, trip: tripRow({ trip_type: type }) });

    expect(await view.findByLabelText(label)).toBeTruthy();
  });

  it('removes the old placeholder buttons', async () => {
    const view = await renderPlanner({ stops: [stopRow(1, 'start', 'Home')] });

    await view.findByText('Home');
    expect(view.queryByLabelText('Save Trip')).toBeNull();
    expect(view.queryByLabelText('Directions')).toBeNull();
    expect(view.queryByText('Trip Distance')).toBeNull();
    expect(view.queryByText('Total Time')).toBeNull();
  });

  it('does not open search from a saved stop', async () => {
    const view = await renderPlanner({ stops: [stopRow(1, 'start', 'Home')] });

    await fireEvent.press(await view.findByTestId('stop-1'));

    expect(router.push).not.toHaveBeenCalled();
  });

  it('removes the add button when the member becomes a viewer on another phone', async () => {
    const view = await renderPlanner({ role: 'editor' });
    await view.findByLabelText('Set start');

    mockRpc('list_trip_members', { data: [member('viewer')] });
    await act(async () =>
      mockChannels()[0].__emit({ eventType: 'UPDATE', new: { user_id: 'user-1' }, old: {} })
    );

    expect(await view.findByText('The owner or an editor can add stops.')).toBeTruthy();
    expect(view.queryByLabelText('Set start')).toBeNull();
  });

  it('reports a missing trip', async () => {
    const view = await renderPlanner({ trip: null });

    expect(await view.findByText('Trip not found')).toBeTruthy();
  });

  it('shows a friendly error when loading fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockTable('trip_stops').__setResult({ data: null, error: { code: '42501' } });
    mockRpc('list_trip_members', { data: [member('owner')] });
    const view = await renderScreen(<PlannerScreen />, signedInAuth());

    expect(await view.findByText("Couldn't load planner")).toBeTruthy();
    expect(view.getByText('You do not have permission to do that.')).toBeTruthy();
  });
});
