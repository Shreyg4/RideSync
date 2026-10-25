import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import TripDetailsScreen from '../trips/[id]';
import type { TripMemberRow, TripRow } from '@/src/services/tripService';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockRpc, mockTable } from '@/src/test/supabase';

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

const withParams = (params: Record<string, unknown>) => {
  (useLocalSearchParams as jest.Mock).mockReturnValue(params);
};

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
});
