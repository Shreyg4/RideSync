// Member settings is where one person changes what everyone else on a trip can do, so these
// check that only the owner gets those controls and that every destructive action asks first.
// Leaving and cancelling the trip are covered in tripSettings.test.tsx

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import MemberSettingsScreen from '../trips/[id]/memberSettings';
import type { AuthContextType } from '@/src/context/AuthProvider';
import type { TripMemberRow } from '@/src/services/tripService';
import { lastAlert, mockAlert, pressAlertButton } from '@/src/test/alert';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockRpc, mockSupabase, mockTable } from '@/src/test/supabase';

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
    <MemberSettingsScreen />,
    signedInAuth({ user: { id: userId } as AuthContextType['user'] })
  );
  await view.findByTestId('member-settings-list');
  return view;
};

const rpcCalls = (fn: string) => mockSupabase.rpc.mock.calls.filter(([name]) => name === fn);

beforeEach(() => {
  jest.clearAllMocks();
  mockAlert();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: '7' });
});

describe('MemberSettingsScreen', () => {
  it('gives the owner controls for every other member, but not for themselves', async () => {
    const view = await renderAs('user-1');

    expect(view.getByText('Ana (you)')).toBeTruthy();
    expect(view.getByLabelText('Editor access for Bea')).toBeTruthy();
    expect(view.getByLabelText('Manage Cal')).toBeTruthy();
    expect(view.queryByLabelText('Editor access for Ana')).toBeNull();
    expect(view.queryByLabelText('Manage Ana')).toBeNull();
  });

  it.each([
    ['an editor', 'user-2', 'Bea'],
    ['a viewer', 'user-3', 'Cal'],
  ])('hides every owner control from %s', async (_, userId, name) => {
    const view = await renderAs(userId);

    expect(view.getByText(`${name} (you)`)).toBeTruthy();
    expect(view.queryAllByLabelText(/^Editor access for/)).toHaveLength(0);
    expect(view.queryAllByLabelText(/^Manage /)).toHaveLength(0);
  });

  it.each([
    ['gives Cal editor access', 'Cal', 'user-3', true, 'editor'],
    ['takes editor access from Bea', 'Bea', 'user-2', false, 'viewer'],
  ])('%s, then reloads the members', async (_, name, userId, on, role) => {
    const view = await renderAs('user-1');
    mockTable('trip_members').__setResult({ data: [{ user_id: userId }] });

    await fireEvent(view.getByLabelText(`Editor access for ${name}`), 'valueChange', on);

    await waitFor(() => expect(rpcCalls('list_trip_members')).toHaveLength(2));
    expect(mockTable('trip_members').update).toHaveBeenCalledWith({ role });
    expect(mockTable('trip_members').eq).toHaveBeenCalledWith('trip_id', 7);
    expect(mockTable('trip_members').eq).toHaveBeenCalledWith('user_id', userId);
  });

  it('asks twice before removing a member', async () => {
    const view = await renderAs('user-1');
    mockTable('trip_members').__setResult({ data: [{ user_id: 'user-2' }] });

    await fireEvent.press(view.getByLabelText('Manage Bea'));
    expect(lastAlert().title).toBe('Bea');
    await pressAlertButton('Remove');
    expect(lastAlert().title).toBe('Remove Bea?');
    expect(mockTable('trip_members').delete).not.toHaveBeenCalled();

    await pressAlertButton('Remove');

    await waitFor(() => expect(mockTable('trip_members').delete).toHaveBeenCalled());
    expect(mockTable('trip_members').eq).toHaveBeenCalledWith('user_id', 'user-2');
  });

  it('asks twice before handing over ownership', async () => {
    const view = await renderAs('user-1');

    await fireEvent.press(view.getByLabelText('Manage Bea'));
    await pressAlertButton('Make Owner');
    expect(lastAlert().title).toBe('Make Bea the owner?');
    expect(rpcCalls('transfer_trip_ownership')).toHaveLength(0);

    await pressAlertButton('Make Owner');

    await waitFor(() =>
      expect(rpcCalls('transfer_trip_ownership')).toEqual([
        ['transfer_trip_ownership', { target_trip_id: 7, new_owner_id: 'user-2' }],
      ])
    );
  });

  it('shows why an action failed and stays on the screen', async () => {
    mockRpc('transfer_trip_ownership', { error: { code: '42501', message: 'permission denied' } });
    const view = await renderAs('user-1');

    await fireEvent.press(view.getByLabelText('Manage Bea'));
    await pressAlertButton('Make Owner');
    await pressAlertButton('Make Owner');

    await waitFor(() =>
      expect(view.getByTestId('member-settings-error')).toHaveTextContent(
        'You do not have permission to do that.'
      )
    );
    expect(rpcCalls('list_trip_members')).toHaveLength(1);
  });

  it('disables every control while an action is running', async () => {
    const view = await renderAs('user-1');
    const transferring = deferred<{ data: unknown; error: unknown }>();
    mockSupabase.rpc.mockImplementationOnce(() => transferring.promise);

    await fireEvent.press(view.getByLabelText('Manage Bea'));
    await pressAlertButton('Make Owner');
    await pressAlertButton('Make Owner');

    expect(view.getByLabelText('Manage Bea')).toBeDisabled();
    expect(view.getByLabelText('Manage Cal')).toBeDisabled();
    // iOS's Switch hands `disabled` straight to the native view, not through accessibilityState
    expect(view.getByLabelText('Editor access for Bea')).toHaveProp('disabled', true);

    await act(async () => transferring.resolve({ data: null, error: null }));
  });

  it('says so when the members cannot be loaded', async () => {
    mockRpc('list_trip_members', { error: { code: '42501', message: 'permission denied' } });

    const view = await renderScreen(<MemberSettingsScreen />, signedInAuth());

    expect(await view.findByText("Couldn't load members")).toBeTruthy();
    expect(view.getByText('You do not have permission to do that.')).toBeTruthy();
  });
});
