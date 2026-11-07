import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import StopListItem from '../StopListItem';
import type { TripStop } from '@/src/types/trip';

const stop = (overrides: Partial<TripStop> = {}): TripStop => ({
  id: 1,
  tripId: 1,
  position: 1,
  name: 'Diner',
  address: '1 Main St',
  lat: 47.6,
  lng: -122.3,
  mapboxId: 'mapbox-1',
  stopType: 'stop',
  stopCategory: 'food',
  notes: null,
  departsAt: null,
  isTurnaround: false,
  ...overrides,
});

describe('StopListItem', () => {
  it('shows the Return heading only on the stop that starts the drive home', async () => {
    const first = await render(<StopListItem stop={stop()} startsReturn />);
    expect(first.getByText('Return')).toBeTruthy();

    const other = await render(<StopListItem stop={stop()} />);
    expect(other.queryByText('Return')).toBeNull();
  });

  it('labels the destination instead of its category', async () => {
    const view = await render(<StopListItem stop={stop({ isTurnaround: true })} />);

    expect(view.getByText('Destination')).toBeTruthy();
    expect(view.queryByText('Food')).toBeNull();
  });

  it('shows the name, address and category', async () => {
    const view = await render(<StopListItem stop={stop()} />);

    expect(view.getByText('Diner')).toBeTruthy();
    expect(view.getByText('1 Main St')).toBeTruthy();
    expect(view.getByText('Food')).toBeTruthy();
  });

  it('labels a start stop by its place in the trip', async () => {
    const view = await render(<StopListItem stop={stop({ stopType: 'start' })} />);

    expect(view.getByText('Start')).toBeTruthy();
    expect(view.queryByText('Food')).toBeNull();
  });

  it('leaves the address out when a stop has none, including for screen readers', async () => {
    const view = await render(<StopListItem stop={stop({ address: null })} testID="row" />);

    expect(view.getByTestId('row').props.accessibilityLabel).toBe('Diner, Food');
  });

  it('calls onPress when it is pressable', async () => {
    const onPress = jest.fn();
    const view = await render(<StopListItem stop={stop()} onPress={onPress} testID="row" />);

    await fireEvent.press(view.getByTestId('row'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not announced as a button without onPress', async () => {
    const view = await render(<StopListItem stop={stop()} testID="row" />);

    expect(view.getByTestId('row').props.accessibilityRole).toBeUndefined();
  });
});
