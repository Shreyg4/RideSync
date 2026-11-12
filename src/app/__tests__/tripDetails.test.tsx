import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import TripDetailsScreen from '../trips/[id]';
import { setErrorReporter } from '@/src/lib/logger';
import type { AuthContextType } from '@/src/context/AuthProvider';
import type { TripMemberRow, TripRow } from '@/src/services/tripService';
import type { TripStopRow } from '@/src/services/tripStopService';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockChannels, mockRpc, mockTable } from '@/src/test/supabase';

// The timeline's markers are hidden from screen readers, so queries have to ask for them
const HIDDEN = { includeHiddenElements: true };

const NOW = new Date(2026, 8, 2, 9, 30, 0, 0).toISOString();

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

const memberRow = (overrides: Partial<TripMemberRow> = {}): TripMemberRow => ({
  user_id: 'user-1',
  display_name: 'Ana',
  role: 'owner',
  avatar_path: 'user-1/avatar.png',
  joined_at: NOW,
  ...overrides,
});

const stopRow: TripStopRow = {
  id: 1,
  trip_id: 1,
  position: 0,
  name: 'Home',
  address: '1 Main St',
  lat: 47.6,
  lng: -122.3,
  mapbox_id: 'mapbox-1',
  stop_type: 'start',
  category: 'other',
  notes: null,
  departs_at: null,
  is_turnaround: false,
  created_at: NOW,
  updated_at: NOW,
};

const withParams = (params: Record<string, unknown>) => {
  (useLocalSearchParams as jest.Mock).mockReturnValue(params);
};

afterEach(() => {
  setErrorReporter(null);
});

describe('TripDetailsScreen', () => {
  it('loads the trip named by the id param', async () => {
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    expect(await view.findByText('Coast Run')).toBeTruthy();
    expect(mockTable('trips').eq).toHaveBeenCalledWith('id', 1);
  });

  it('narrows a repeated param to its first value instead of comparing against an array', async () => {
    withParams({ id: ['7', '8'] });
    mockTable('trips').__setResult({ data: tripRow({ id: 7 }), error: null });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    expect(await view.findByText('Coast Run')).toBeTruthy();
    expect(mockTable('trips').eq).toHaveBeenCalledWith('id', 7);
  });

  it('shows the join code with a dash and lists the members', async () => {
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockRpc('list_trip_members', {
      data: [memberRow(), memberRow({ user_id: 'user-2', display_name: 'Bea', role: 'viewer' })],
    });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    expect(await view.findByText('Bea')).toBeTruthy();
    expect(view.getByText('Ana')).toBeTruthy();
    expect(view.getByTestId('trip-join-code')).toHaveTextContent('ABCD-2345');
  });

  it('reports a missing trip rather than crashing', async () => {
    withParams({ id: '9999' });
    mockTable('trips').__setResult({ data: null, error: null });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    expect(await view.findByText('Trip not found')).toBeTruthy();
  });

  it('shows a friendly error when the trip fails to load', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: null, error: { code: 'PGRST116' } });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    expect(await view.findByText("Couldn't load trip")).toBeTruthy();
    expect(view.getByText('We could not find that.')).toBeTruthy();
  });

  it('shares the formatted join code and the invite link', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    await fireEvent.press(await view.findByLabelText('Invite friends'));

    expect(share).toHaveBeenCalledWith({
      message:
        'Join my trip "Coast Run" on RideSync with code ABCD-2345\nridesync://invite/ABCD2345',
    });
  });

  it('reports a failed share and stays on the trip', async () => {
    const reporter = jest.fn();
    setErrorReporter(reporter);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const shareError = new Error('share sheet unavailable');
    jest.spyOn(Share, 'share').mockRejectedValueOnce(shareError);
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    await fireEvent.press(await view.findByLabelText('Invite friends'));

    await waitFor(() =>
      expect(reporter).toHaveBeenCalledWith(shareError, { scope: 'TripDetailsScreen.shareInvite' })
    );
    expect(view.getByText('Coast Run')).toBeTruthy();
  });

  it('opens trip settings for this trip', async () => {
    (router.push as jest.Mock).mockClear();
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    await fireEvent.press(await view.findByLabelText('Trip settings'));

    expect(router.push).toHaveBeenCalledWith('/trips/1/tripSettings');
  });

  it('shows a member who joins on another phone without leaving the screen', async () => {
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockRpc('list_trip_members', { data: [memberRow()] });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());
    await view.findByText('Ana');

    mockRpc('list_trip_members', {
      data: [memberRow(), memberRow({ user_id: 'user-2', display_name: 'Bea', role: 'viewer' })],
    });
    await act(async () =>
      mockChannels()[0].__emit({ eventType: 'INSERT', new: { user_id: 'user-2' }, old: {} })
    );

    expect(await view.findByText('Bea')).toBeTruthy();
  });

  it('lists the stops in the itinerary', async () => {
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockTable('trip_stops').__setResult({
      data: [{ ...stopRow, id: 5, name: 'Home' }],
      error: null,
    });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    expect(await view.findByTestId('stop-5')).toBeTruthy();
    expect(view.getByText('Home')).toBeTruthy();
    expect(view.queryByText('Not planned')).toBeNull();
  });

  it('shows a stop added on another phone without leaving the screen', async () => {
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockTable('trip_stops').__setResult({ data: [], error: null });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());
    await view.findByText('Not planned');

    mockTable('trip_stops').__setResult({ data: [{ ...stopRow, id: 5 }], error: null });
    const stopsChannel = mockChannels().find(({ topic }) => topic.startsWith('trip-stops:'));
    await act(async () =>
      stopsChannel?.__emit({ eventType: 'INSERT', new: { id: 5, trip_id: 1 }, old: {} })
    );

    expect(await view.findByTestId('stop-5')).toBeTruthy();
    expect(view.queryByText('Not planned')).toBeNull();
  });

  it('shows a round trip’s drive home under its own heading, ending back at the start', async () => {
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow({ trip_type: 'round-trip' }), error: null });
    mockTable('trip_stops').__setResult({
      data: [
        stopRow,
        { ...stopRow, id: 2, position: 1, name: 'Coast', stop_type: 'stop', is_turnaround: true },
        { ...stopRow, id: 3, position: 2, name: 'Diner', stop_type: 'stop' },
      ],
      error: null,
    });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    await view.findByText('Coast');
    expect(
      view.getAllByText(/^(Home|Coast|Diner|Return)$/).map((node) => node.props.children)
    ).toEqual(['Home', 'Coast', 'Return', 'Diner', 'Home']);
    expect(view.getByTestId('back-to-start')).toBeTruthy();
    expect(view.getByTestId('pin-1', HIDDEN)).toBeTruthy();
    expect(view.getByTestId('pin-2', HIDDEN)).toBeTruthy();
    expect(view.getByTestId('dot-3', HIDDEN)).toBeTruthy();
    expect(view.getByTestId('pin-back-to-start', HIDDEN)).toBeTruthy();
    expect(view.queryByLabelText('Add return stop')).toBeNull();
  });

  it('shows only the start of a long itinerary and points to the planner for the rest', async () => {
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockTable('trip_stops').__setResult({
      data: [1, 2, 3, 4, 5, 6, 7].map((id) => ({
        ...stopRow,
        id,
        position: id - 1,
        name: `Place ${id}`,
        stop_type: id === 1 ? 'start' : id === 7 ? 'end' : 'stop',
      })),
      error: null,
    });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    await view.findByText('Place 1');
    expect(view.getAllByTestId(/^stop-/).map((row) => row.props.testID)).toEqual([
      'stop-1',
      'stop-2',
      'stop-3',
      'stop-4',
    ]);
    expect(view.getByTestId('itinerary-more-stops').props.children).toBe(
      '3 more stops in the planner'
    );
  });

  it('shows a short itinerary in full, with no count', async () => {
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockTable('trip_stops').__setResult({ data: [stopRow], error: null });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    await view.findByText('Home');
    expect(view.queryByTestId('itinerary-more-stops')).toBeNull();
  });

  it('opens the route map from Directions', async () => {
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockTable('trip_stops').__setResult({
      data: [
        { ...stopRow, id: 5, name: 'Home' },
        { ...stopRow, id: 6, position: 1, name: 'Coast', stop_type: 'end' },
      ],
      error: null,
    });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());
    await view.findByTestId('stop-6');

    await fireEvent.press(view.getByTestId('trip-directions-button'));

    expect(router.push).toHaveBeenCalledWith('/trips/1/map');
  });

  it('keeps Directions off until there are two places to drive between', async () => {
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockTable('trip_stops').__setResult({ data: [{ ...stopRow, id: 5 }], error: null });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());
    await view.findByTestId('stop-5');

    expect(view.getByTestId('trip-directions-button')).toBeDisabled();
  });

  it('says the trip is not planned when it has no stops', async () => {
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockTable('trip_stops').__setResult({ data: [], error: null });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    expect(await view.findByText('Not planned')).toBeTruthy();
  });

  it('shows a friendly error when the stops fail to load', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockTable('trip_stops').__setResult({ data: null, error: { code: '42501' } });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    expect(await view.findByText('You do not have permission to do that.')).toBeTruthy();
  });

  it('offers a viewer the itinerary to view and opens this trip’s planner', async () => {
    (router.push as jest.Mock).mockClear();
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockRpc('list_trip_members', { data: [memberRow({ role: 'viewer' })] });
    const view = await renderScreen(
      <TripDetailsScreen />,
      signedInAuth({ user: { id: 'user-1' } as AuthContextType['user'] })
    );

    await fireEvent.press(await view.findByLabelText('View itinerary'));

    expect(router.push).toHaveBeenCalledWith('/trips/1/planner');
  });

  it('offers an owner the itinerary to edit', async () => {
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    mockRpc('list_trip_members', { data: [memberRow({ role: 'owner' })] });
    const view = await renderScreen(
      <TripDetailsScreen />,
      signedInAuth({ user: { id: 'user-1' } as AuthContextType['user'] })
    );

    expect(await view.findByLabelText('Edit itinerary')).toBeTruthy();
  });

  it('sends a member who is removed on another phone back to Trips', async () => {
    (router.dismissTo as jest.Mock).mockClear();
    withParams({ id: '1' });
    mockTable('trips').__setResult({ data: tripRow(), error: null });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());
    await view.findByText('Coast Run');

    await act(async () =>
      mockChannels()[0].__emit({ eventType: 'DELETE', new: {}, old: { user_id: 'user-1' } })
    );

    expect(router.dismissTo).toHaveBeenCalledWith('/trips');
  });
});
