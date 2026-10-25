import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import React, { useEffect, type EffectCallback } from 'react';
import { act } from '@testing-library/react-native';
import TripsScreen from '../(tabs)/trips';
import type { TripRow } from '@/src/services/tripService';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockSupabase, mockTable } from '@/src/test/supabase';

const NOW = new Date(2026, 8, 2, 9, 30, 0, 0).toISOString();

const tripRow: TripRow = {
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
};

const expoRouter = jest.requireMock<typeof import('expo-router')>('expo-router');

// Runs on mount like the shared mock, but keeps the latest callback so a test can focus again
let focusAgain: () => void = () => {};
function useRecordedFocusEffect(effect: EffectCallback) {
  focusAgain = effect;
  useEffect(effect, [effect]);
}

const tripLoads = () => mockSupabase.from.mock.calls.filter(([table]) => table === 'trips');

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(expoRouter, 'useFocusEffect').mockImplementation(useRecordedFocusEffect);
});

describe('TripsScreen', () => {
  it('lists the trips', async () => {
    mockTable('trips').__setResult({ data: [tripRow] });

    const view = await renderScreen(<TripsScreen />, signedInAuth());

    expect(await view.findByText('Coast Run')).toBeTruthy();
  });

  it('says it could not load the trips, and why', async () => {
    mockTable('trips').__setResult({ error: { code: 'PGRST116' } });

    const view = await renderScreen(<TripsScreen />, signedInAuth());

    expect(await view.findByText("Couldn't load trips")).toBeTruthy();
    expect(view.getByText('We could not find that.')).toBeTruthy();
  });

  it('reloads when the tab is focused again, but not on its first focus', async () => {
    mockTable('trips').__setResult({ data: [tripRow] });
    const view = await renderScreen(<TripsScreen />, signedInAuth());
    await view.findByText('Coast Run');
    expect(tripLoads()).toHaveLength(1);

    await act(async () => focusAgain());

    expect(tripLoads()).toHaveLength(2);
  });
});
