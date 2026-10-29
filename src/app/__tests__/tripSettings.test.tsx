// Trip settings decides which sections a member can open by their role, and holds the two
// actions that end someone's trip, so these check both are gated and that each asks first.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert } from 'react-native';
import TripSettingsScreen from '../trips/[id]/tripSettings';
import type { AuthContextType } from '@/src/context/AuthProvider';
import type { TripMemberRow } from '@/src/services/tripService';
import { lastAlert, mockAlert, pressAlertButton } from '@/src/test/alert';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockRpc, mockSupabase } from '@/src/test/supabase';

const JOINED = new Date(2026, 8, 2, 9, 30).toISOString();

const memberRow = (user_id: string, display_name: string, role: string): TripMemberRow => ({
  user_id,
  display_name,
  role,
  avatar_path: '',
  joined_at: JOINED,
});

const ANA = memberRow('user-1', 'Ana', 'owner');
const BEA = memberRow('user-2', 'Bea', 'editor');
const CAL = memberRow('user-3', 'Cal', 'viewer');

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const renderAs = async (userId: string, members = [ANA, BEA, CAL]) => {
  mockRpc('list_trip_members', { data: members });
  const view = await renderScreen(
    <TripSettingsScreen />,
    signedInAuth({ user: { id: userId } as AuthContextType['user'] })
  );
  await view.findByTestId('trip-settings-list');
  return view;
};

const rpcCalls = (fn: string) => mockSupabase.rpc.mock.calls.filter(([name]) => name === fn);

beforeEach(() => {
  jest.clearAllMocks();
  mockAlert();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: '7' });
});

describe('TripSettingsScreen', () => {
  it('gives the owner every section and both trip actions', async () => {
    const view = await renderAs('user-1');

    expect(view.getByTestId('members-row')).toBeTruthy();
    expect(view.getByTestId('edit-trip-row')).toBeTruthy();
    expect(view.getByTestId('leave-trip-button')).toBeTruthy();
    expect(view.getByTestId('cancel-trip-button')).toBeTruthy();
  });

  it('lets an editor edit the trip but not cancel it', async () => {
    const view = await renderAs('user-2');

    expect(view.getByTestId('edit-trip-row')).toBeTruthy();
    expect(view.getByTestId('leave-trip-button')).toBeTruthy();
    expect(view.queryByTestId('cancel-trip-button')).toBeNull();
  });

  it('hides editing and cancelling from a viewer', async () => {
    const view = await renderAs('user-3');

    expect(view.getByTestId('members-row')).toBeTruthy();
    expect(view.queryByTestId('edit-trip-row')).toBeNull();
    expect(view.getByTestId('leave-trip-button')).toBeTruthy();
    expect(view.queryByTestId('cancel-trip-button')).toBeNull();
  });

  it.each([
    ['members-row', '/trips/7/memberSettings'],
    ['edit-trip-row', '/trips/7/editTrip'],
  ])('opens the section behind %s', async (testID, path) => {
    const view = await renderAs('user-1');

    await fireEvent.press(view.getByTestId(testID));

    expect(router.push).toHaveBeenCalledWith(path);
  });

  it.each([
    [
      'a member who is not the owner',
      'user-3',
      [ANA, BEA, CAL],
      "You'll need the join code to get back in.",
    ],
    // Cal joined before Bea, but an editor takes over ahead of a viewer
    ['the owner who takes over', 'user-1', [ANA, CAL, BEA], 'Bea becomes the owner.'],
    [
      'a sole owner that the trip will be deleted',
      'user-1',
      [ANA],
      "You're the only member, so the trip will be deleted.",
    ],
  ])('tells %s before they leave', async (_, userId, members, message) => {
    const view = await renderAs(userId, members);

    await fireEvent.press(view.getByTestId('leave-trip-button'));

    expect(Alert.alert).toHaveBeenCalledWith('Leave trip?', message, expect.any(Array));
  });

  it('leaves the trip once confirmed and goes back to the trips list', async () => {
    const view = await renderAs('user-3');

    await fireEvent.press(view.getByTestId('leave-trip-button'));
    await pressAlertButton('Leave');

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/trips'));
    expect(rpcCalls('leave_trip')).toEqual([['leave_trip', { target_trip_id: 7 }]]);
  });

  it('cancels the trip once confirmed and goes back to the trips list', async () => {
    const view = await renderAs('user-1');

    await fireEvent.press(view.getByTestId('cancel-trip-button'));
    expect(lastAlert().buttons.map((button) => button.text)).toEqual(['Keep Trip', 'Cancel Trip']);
    await pressAlertButton('Cancel Trip');

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/trips'));
    expect(rpcCalls('cancel_trip')).toEqual([['cancel_trip', { target_trip_id: 7 }]]);
  });

  it('shows why an action failed and stays on the screen', async () => {
    mockRpc('leave_trip', { error: { code: '42501', message: 'permission denied' } });
    const view = await renderAs('user-3');

    await fireEvent.press(view.getByTestId('leave-trip-button'));
    await pressAlertButton('Leave');

    await waitFor(() =>
      expect(view.getByTestId('trip-settings-error')).toHaveTextContent(
        'You do not have permission to do that.'
      )
    );
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('disables both trip actions while one is running', async () => {
    const view = await renderAs('user-1');
    const leaving = deferred<{ data: unknown; error: unknown }>();
    mockSupabase.rpc.mockImplementationOnce(() => leaving.promise);

    await fireEvent.press(view.getByTestId('leave-trip-button'));
    await pressAlertButton('Leave');

    expect(view.getByTestId('leave-trip-button')).toBeDisabled();
    expect(view.getByTestId('cancel-trip-button')).toBeDisabled();

    await act(async () => leaving.resolve({ data: null, error: null }));
  });

  it('says so when the settings cannot be loaded', async () => {
    mockRpc('list_trip_members', { error: { code: '42501', message: 'permission denied' } });

    const view = await renderScreen(<TripSettingsScreen />, signedInAuth());

    expect(await view.findByText("Couldn't load trip settings")).toBeTruthy();
    expect(view.queryByTestId('leave-trip-button')).toBeNull();
  });
});
