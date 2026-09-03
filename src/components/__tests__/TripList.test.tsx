import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import React from 'react';
import { router } from 'expo-router';
import TripList from '../TripList';
import { renderScreen } from '@/src/test/render';
import type { Trip } from '@/src/types/trip';

const trip = (overrides: Partial<Trip> = {}): Trip => ({
  id: 1,
  numMembers: 4,
  image: null,
  name: 'Mount Rainier',
  departureDate: '07/10/2026',
  departureTime: '7:00 AM',
  duration: 'single-day',
  tripType: 'round-trip',
  ...overrides,
});

describe('TripList', () => {
  it('renders the empty state when there are no trips', async () => {
    const view = await renderScreen(
      <TripList data={[]} emptyTitle="No upcoming trips" emptySubtitle="Press the + button" />
    );

    expect(view.getByText('No upcoming trips')).toBeTruthy();
    expect(view.getByText('Press the + button')).toBeTruthy();
  });

  it('omits the subtitle when none is given', async () => {
    const view = await renderScreen(<TripList data={[]} emptyTitle="No saved trips" />);

    expect(view.getByText('No saved trips')).toBeTruthy();
    expect(view.queryByText('Press the + button')).toBeNull();
  });

  it('renders a row per trip and no empty state', async () => {
    const view = await renderScreen(
      <TripList
        data={[trip(), trip({ id: 2, name: 'World Cup Trip' })]}
        emptyTitle="No upcoming trips"
      />
    );

    expect(view.getByText('Mount Rainier')).toBeTruthy();
    expect(view.getByText('World Cup Trip')).toBeTruthy();
    expect(view.queryByText('No upcoming trips')).toBeNull();
  });

  it('shows the loading state instead of the empty state', async () => {
    const view = await renderScreen(
      <TripList data={[]} emptyTitle="No upcoming trips" loading testID="trips" />
    );

    expect(view.getByTestId('trips-loading')).toBeTruthy();
    expect(view.queryByText('No upcoming trips')).toBeNull();
  });

  it('opens a trip under /trips/:id', async () => {
    (router.push as jest.Mock).mockClear();
    const view = await renderScreen(<TripList data={[trip({ id: 7 })]} emptyTitle="empty" />);

    await fireEvent.press(view.getByText('Mount Rainier'));

    expect(router.push).toHaveBeenCalledWith('/trips/7');
  });
});
