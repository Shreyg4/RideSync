// The planner shows the trip's real stops, and its add button depends on the member's role and on
// which stops already exist, so these check both

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { colors } from '@/src/constants/theme';
import PlannerScreen from '../trips/[id]/planner';
import type { AuthContextType } from '@/src/context/AuthProvider';
import type { TripRow } from '@/src/services/tripService';
import type { TripStopRow } from '@/src/services/tripStopService';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockChannels, mockRpc, mockTable } from '@/src/test/supabase';

// The timeline's markers are hidden from screen readers, so queries have to ask for them
const HIDDEN = { includeHiddenElements: true };

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
  is_turnaround: false,
  created_at: NOW,
  updated_at: NOW,
});

const shortDate = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

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

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/trips/[id]/addStop',
      params: { id: 1, stopType: 'start' },
    });
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
    ['round-trip', [stopRow(1, 'start', 'Home')], 'Set destination'],
    [
      'round-trip',
      [stopRow(1, 'start', 'Home'), { ...stopRow(2, 'stop', 'Coast'), is_turnaround: true }],
      'Add stop',
    ],
  ])('on a %s trip with these stops, the button reads correctly', async (type, stops, label) => {
    const view = await renderPlanner({ stops, trip: tripRow({ trip_type: type }) });

    expect(await view.findByLabelText(label)).toBeTruthy();
  });

  it('opens search for the destination when a round trip needs one', async () => {
    const view = await renderPlanner({
      stops: [stopRow(1, 'start', 'Home')],
      trip: tripRow({ trip_type: 'round-trip' }),
    });

    await fireEvent.press(await view.findByLabelText('Set destination'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/trips/[id]/addStop',
      params: { id: 1, stopType: 'destination' },
    });
  });

  describe('a round trip with its destination', () => {
    const renderRoundTrip = (role = 'owner') =>
      renderPlanner({
        role,
        stops: [
          stopRow(1, 'start', 'Home'),
          { ...stopRow(2, 'overnight', 'Coast'), is_turnaround: true },
          stopRow(3, 'stop', 'Diner'),
        ],
        trip: tripRow({ trip_type: 'round-trip' }),
      });

    // Rows and buttons in the order they appear on screen
    const order = (view: Awaited<ReturnType<typeof renderPlanner>>) =>
      view
        .getAllByText(/^(Home|Coast|Diner|Return|Add stop|Add return stop)$/)
        .map((node) => node.props.children);

    it('puts Add stop before the destination and Add return stop after the drive home', async () => {
      const view = await renderRoundTrip();

      await view.findByText('Coast');
      expect(order(view)).toEqual([
        'Home',
        'Add stop',
        'Coast',
        'Diner',
        'Add return stop',
        'Home',
      ]);
      expect(view.getByText('Destination (overnight)')).toBeTruthy();
    });

    it('starts the drive home on Day 2, the morning after the night at the destination', async () => {
      const view = await renderRoundTrip();

      expect((await view.findByTestId('day-1')).props.children).toBe(
        `Day 1 · ${shortDate(new Date(2026, 8, 2))}`
      );
      expect(view.getByTestId('day-2').props.children).toBe(
        `Day 2 · ${shortDate(new Date(2026, 8, 3))} · Return`
      );
      expect(view.queryByText('Return')).toBeNull();
    });

    it('tints the start, the destination and the return to the start, not the stops between', async () => {
      const view = await renderRoundTrip();
      await view.findByText('Coast');

      const border = (testID: string) =>
        StyleSheet.flatten((view.getByTestId(testID).children[0] as ReactTestInstance).props.style)
          .borderColor;

      expect(border('stop-1')).toBe(colors.tint);
      expect(border('stop-2')).toBe(colors.tint);
      expect(border('back-to-start')).toBe(colors.tint);
      expect(border('stop-3')).toBe('transparent');
    });

    it('pins the start, destination and finish, and gives other stops a dot', async () => {
      const view = await renderRoundTrip();
      await view.findByText('Coast');

      expect(view.getByTestId('pin-1', HIDDEN)).toBeTruthy();
      expect(view.getByTestId('pin-2', HIDDEN)).toBeTruthy();
      expect(view.getByTestId('pin-back-to-start', HIDDEN)).toBeTruthy();
      expect(view.getByTestId('dot-3', HIDDEN)).toBeTruthy();
      expect(view.queryByTestId('pin-3', HIDDEN)).toBeNull();
    });

    it('finishes the list back at the start', async () => {
      const view = await renderRoundTrip();

      const finish = await view.findByTestId('back-to-start');
      expect(finish.props.accessibilityLabel).toBe('Home, Home address, Back to start');
    });

    it('opens search for a stop on the way out without a position', async () => {
      const view = await renderRoundTrip();

      await fireEvent.press(await view.findByLabelText('Add stop'));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/trips/[id]/addStop',
        params: { id: 1, stopType: 'stop' },
      });
    });

    it('opens search for a stop on the way home at the end of the list', async () => {
      const view = await renderRoundTrip();

      await fireEvent.press(await view.findByLabelText('Add return stop'));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/trips/[id]/addStop',
        params: { id: 1, stopType: 'stop', atPosition: 3 },
      });
    });

    it('shows a viewer the legs and the finish without the buttons', async () => {
      const view = await renderRoundTrip('viewer');

      await view.findByText('Coast');
      expect(order(view)).toEqual(['Home', 'Coast', 'Diner', 'Home']);
    });
  });

  it('puts Add stop just before a one-way trip’s end', async () => {
    const view = await renderPlanner({
      stops: [stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast')],
    });

    await view.findByText('Coast');
    expect(view.getAllByText(/^(Home|Coast|Add stop)$/).map((node) => node.props.children)).toEqual(
      ['Home', 'Add stop', 'Coast']
    );
    expect(view.queryByTestId('back-to-start')).toBeNull();
  });

  it('removes the old placeholder buttons', async () => {
    const view = await renderPlanner({ stops: [stopRow(1, 'start', 'Home')] });

    await view.findByText('Home');
    expect(view.queryByLabelText('Save Trip')).toBeNull();
    expect(view.queryByLabelText('Directions')).toBeNull();
    expect(view.queryByText('Trip Distance')).toBeNull();
    expect(view.queryByText('Total Time')).toBeNull();
  });

  it('opens a saved stop’s details, not search', async () => {
    const view = await renderPlanner({ stops: [stopRow(1, 'start', 'Home')] });

    await fireEvent.press(await view.findByTestId('stop-1'));

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/trips/[id]/stopDetails',
      params: { id: 1, stopId: 1 },
    });
  });

  it('lets a viewer open a stop too, to read its details', async () => {
    const view = await renderPlanner({ role: 'viewer', stops: [stopRow(1, 'start', 'Home')] });

    await fireEvent.press(await view.findByTestId('stop-1'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: 1, stopId: 1 } })
    );
  });

  it('opens the start from the Back to start row on a round trip', async () => {
    const stops = [
      stopRow(1, 'start', 'Home'),
      { ...stopRow(2, 'stop', 'Coast'), is_turnaround: true },
    ];
    const view = await renderPlanner({ stops, trip: tripRow({ trip_type: 'round-trip' }) });

    await fireEvent.press(await view.findByTestId('back-to-start'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: 1, stopId: 1 } })
    );
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
