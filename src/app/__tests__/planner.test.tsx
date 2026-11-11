// The planner shows the trip's real stops, and its add button depends on the member's role and on
// which stops already exist, so these check both

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
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
import { mockChannels, mockRpc, mockSupabase, mockTable } from '@/src/test/supabase';

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

  describe('the map', () => {
    const oneWay = [
      stopRow(1, 'start', 'Home'),
      stopRow(2, 'stop', 'Diner'),
      stopRow(3, 'end', 'Coast'),
    ];

    it('puts every stop on the map, numbered in trip order', async () => {
      const view = await renderPlanner({ stops: oneWay });

      expect(await view.findByTestId('planner-map')).toBeTruthy();
      expect(view.getByLabelText('Stop 1, Home')).toHaveTextContent('1');
      expect(view.getByLabelText('Stop 2, Diner')).toHaveTextContent('2');
      expect(view.getByLabelText('Stop 3, Coast')).toHaveTextContent('3');
    });

    it('opens the full-screen map for this trip when the map is tapped', async () => {
      const view = await renderPlanner({ stops: oneWay });

      await fireEvent.press(await view.findByLabelText('Open map'));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/trips/[id]/map',
        params: { id: 1 },
      });
    });

    it('lets a viewer open the full-screen map too', async () => {
      const view = await renderPlanner({ role: 'viewer', stops: oneWay });

      await fireEvent.press(await view.findByLabelText('Open map'));

      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/trips/[id]/map' })
      );
    });

    it('keeps the small map from panning or opening pins, so a tap always opens the full map', async () => {
      const view = await renderPlanner({ stops: oneWay });
      await view.findByTestId('planner-map');

      expect(view.getByLabelText('Stop 2, Diner')).toBeDisabled();
      expect(view.getByTestId('planner-map').parent?.props.pointerEvents).toBe('none');
    });

    it('is not shown until the trip has a stop', async () => {
      const view = await renderPlanner();

      await view.findByText('No stops yet');
      expect(view.queryByTestId('planner-map')).toBeNull();
    });
  });

  describe('swiping a stop to remove it', () => {
    const trip = [
      stopRow(1, 'start', 'Home'),
      stopRow(2, 'stop', 'Diner'),
      stopRow(3, 'stop', 'Gas'),
      stopRow(4, 'end', 'Coast'),
    ];
    const removeCalls = () =>
      mockSupabase.rpc.mock.calls.filter(([name]) => name === 'remove_trip_stop');

    // Stands in for the swipe that reveals the button
    const swipeOpen = async (view: Awaited<ReturnType<typeof renderPlanner>>, stopId: number) => {
      await fireEvent(view.getByTestId(`swipe-stop-${stopId}`), 'touchStart');
      await fireEvent.press(view.getByTestId(`swipe-stop-${stopId}-swipe`));
    };

    it.each(['owner', 'editor'])('lets an %s swipe a normal stop', async (role) => {
      const view = await renderPlanner({ role, stops: trip });
      await view.findByText('Diner');

      expect(view.getByLabelText('Remove Diner')).toBeTruthy();
      expect(view.getByLabelText('Remove Gas')).toBeTruthy();
    });

    it('never offers to remove the start or end, which can only be moved', async () => {
      const view = await renderPlanner({ stops: trip });
      await view.findByText('Home');

      expect(view.queryByTestId('swipe-stop-1')).toBeNull();
      expect(view.queryByTestId('swipe-stop-4')).toBeNull();
      expect(view.queryByLabelText('Remove Home')).toBeNull();
      expect(view.queryByLabelText('Remove Coast')).toBeNull();
    });

    it('never offers to remove a round trip’s destination', async () => {
      const destination = { ...stopRow(2, 'stop', 'Coast'), is_turnaround: true };
      const view = await renderPlanner({
        stops: [stopRow(1, 'start', 'Home'), destination],
        trip: tripRow({ trip_type: 'round-trip' }),
      });
      await view.findAllByText('Coast');

      expect(view.queryByLabelText('Remove Coast')).toBeNull();
    });

    it('gives a viewer nothing to swipe', async () => {
      const view = await renderPlanner({ role: 'viewer', stops: trip });
      await view.findByText('Diner');

      expect(view.queryByTestId('swipe-stop-2')).toBeNull();
      expect(view.queryByLabelText('Remove Diner')).toBeNull();
    });

    it('removes the stop from the trash button, with no confirm step, and shows the new list', async () => {
      const view = await renderPlanner({ stops: trip });
      await view.findByText('Diner');
      await swipeOpen(view, 2);

      mockTable('trip_stops').__setResult({
        data: [trip[0], trip[2], trip[3]],
        error: null,
      });
      await fireEvent.press(view.getByLabelText('Remove Diner'));

      expect(removeCalls()).toEqual([['remove_trip_stop', { target_stop_id: 2 }]]);
      await waitFor(() => expect(view.queryByText('Diner')).toBeNull());
      expect(view.getByText('Gas')).toBeTruthy();
    });

    it('shows a friendly error and closes the row when removing fails', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const view = await renderPlanner({ stops: trip });
      await view.findByText('Diner');
      await swipeOpen(view, 2);

      mockRpc('remove_trip_stop', { data: null, error: { code: '42501' } });
      await fireEvent.press(view.getByLabelText('Remove Diner'));

      expect(await view.findByText('You do not have permission to do that.')).toBeTruthy();
      expect(view.getByText('Diner')).toBeTruthy();
    });

    it('closes the open row on a tap elsewhere, without doing what was tapped', async () => {
      const view = await renderPlanner({ stops: trip });
      await view.findByText('Diner');
      await swipeOpen(view, 2);
      (router.push as jest.Mock).mockClear();

      // A tap on another stop's card: the screen sees the touch begin outside the open row
      await fireEvent(view.getByTestId('stop-1'), 'touchStart');
      await fireEvent.press(view.getByTestId('stop-1'));

      expect(router.push).not.toHaveBeenCalled();

      // The row is closed, so the next tap works normally
      await fireEvent(view.getByTestId('stop-1'), 'touchStart');
      await fireEvent.press(view.getByTestId('stop-1'));
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({ params: { id: 1, stopId: 1 } })
      );
    });

    it('closes the open row when its own card is tapped, instead of opening the stop', async () => {
      const view = await renderPlanner({ stops: trip });
      await view.findByText('Diner');
      await swipeOpen(view, 2);
      (router.push as jest.Mock).mockClear();

      await fireEvent(view.getByTestId('swipe-stop-2'), 'touchStart');
      await fireEvent.press(view.getByTestId('stop-2'));

      expect(router.push).not.toHaveBeenCalled();
    });

    it('keeps the add buttons and the map from acting on the tap that closes a row', async () => {
      const view = await renderPlanner({ stops: trip });
      await view.findByText('Diner');

      await swipeOpen(view, 2);
      (router.push as jest.Mock).mockClear();
      await fireEvent(view.getByLabelText('Open map'), 'touchStart');
      await fireEvent.press(view.getByLabelText('Open map'));

      expect(router.push).not.toHaveBeenCalled();
    });

    it('opens stops normally when no row is open', async () => {
      const view = await renderPlanner({ stops: trip });
      await view.findByText('Diner');

      await fireEvent(view.getByTestId('swipe-stop-2'), 'touchStart');
      await fireEvent.press(view.getByTestId('stop-2'));

      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({ params: { id: 1, stopId: 2 } })
      );
    });
  });

  describe('stop changes on another phone', () => {
    const stopsChannel = () => {
      const channel = mockChannels().find(({ topic }) => topic.startsWith('trip-stops:'));
      if (!channel) throw new Error('the planner is not listening for stop changes');
      return channel;
    };

    it('listens for changes to this trip’s stops', async () => {
      const view = await renderPlanner();
      await view.findByText('No stops yet');

      expect(stopsChannel().on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table: 'trip_stops', filter: 'trip_id=eq.1' }),
        expect.any(Function)
      );
    });

    it('shows a stop added on another phone, in the list and on the map', async () => {
      const view = await renderPlanner({ stops: [stopRow(1, 'start', 'Home')] });
      await view.findByText('Home');

      mockTable('trip_stops').__setResult({
        data: [stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast')],
        error: null,
      });
      await act(async () =>
        stopsChannel().__emit({ eventType: 'INSERT', new: { id: 2, trip_id: 1 }, old: {} })
      );

      expect(await view.findByText('Coast')).toBeTruthy();
      expect(view.getByLabelText('Stop 2, Coast')).toBeTruthy();
    });

    it('drops a stop removed on another phone, from a delete that only carries its id', async () => {
      const view = await renderPlanner({
        stops: [stopRow(1, 'start', 'Home'), stopRow(2, 'end', 'Coast')],
      });
      await view.findByText('Coast');

      mockTable('trip_stops').__setResult({ data: [stopRow(1, 'start', 'Home')], error: null });
      await act(async () =>
        stopsChannel().__emit({ eventType: 'DELETE', new: {}, old: { id: 2 } })
      );

      await waitFor(() => expect(view.queryByText('Coast')).toBeNull());
      expect(view.queryByLabelText('Stop 2, Coast')).toBeNull();
    });
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
