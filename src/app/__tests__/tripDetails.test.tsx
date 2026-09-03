import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import TripDetailsScreen from '../trips/[id]';
import { renderScreen, signedInAuth } from '@/src/test/render';

const withParams = (params: Record<string, unknown>) => {
  (useLocalSearchParams as jest.Mock).mockReturnValue(params);
};

describe('TripDetailsScreen', () => {
  it('finds the trip named by the id param', async () => {
    withParams({ id: '1' });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    expect(view.getByText('Mount Rainier')).toBeTruthy();
  });

  it('narrows a repeated param instead of comparing against an array', async () => {
    withParams({ id: ['1', '2'] });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    expect(view.getByText('Mount Rainier')).toBeTruthy();
  });

  it('reports a missing trip rather than crashing', async () => {
    withParams({ id: '9999' });
    const view = await renderScreen(<TripDetailsScreen />, signedInAuth());

    expect(view.getByText('Trip not Found')).toBeTruthy();
  });
});
