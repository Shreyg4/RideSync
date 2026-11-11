import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { colors } from '@/src/constants/theme';
import type { TripStop } from '@/src/types/trip';
import StopsMap from '../StopsMap';

const stop = (
  id: number,
  name: string,
  stopType: TripStop['stopType'],
  lat: number,
  lng: number
): TripStop => ({
  id,
  tripId: 1,
  position: id - 1,
  name,
  address: null,
  lat,
  lng,
  mapboxId: null,
  stopType,
  stopCategory: 'other',
  notes: null,
  departsAt: null,
  isTurnaround: false,
});

const stops = [
  stop(1, 'Home', 'start', 47.6, -122.3),
  stop(2, 'Diner', 'stop', 46.6, -120.5),
  stop(3, 'Coast', 'end', 45.5, -122.7),
];

describe('StopsMap', () => {
  it('numbers the pins in trip order', async () => {
    const view = await render(<StopsMap stops={stops} />);

    expect(view.getByLabelText('Stop 1, Home')).toHaveTextContent('1');
    expect(view.getByLabelText('Stop 2, Diner')).toHaveTextContent('2');
    expect(view.getByLabelText('Stop 3, Coast')).toHaveTextContent('3');
  });

  it('places each pin longitude first, the order Mapbox expects', async () => {
    const view = await render(<StopsMap stops={stops} />);

    expect(view.getByTestId('map-pin-2').props.coordinate).toEqual([-120.5, 46.6]);
  });

  it('keeps pins of nearby stops from hiding each other', async () => {
    const view = await render(<StopsMap stops={stops} />);

    expect(view.getByTestId('map-pin-1').props.allowOverlap).toBe(true);
  });

  it('fits the map to every stop', async () => {
    const view = await render(<StopsMap stops={stops} />);

    expect(view.getByTestId('mapbox-camera').props.bounds).toEqual({
      ne: [-120.5, 47.6],
      sw: [-122.7, 45.5],
    });
  });

  it('tints the start and end, as the itinerary does, and not the stops between', async () => {
    const view = await render(<StopsMap stops={stops} />);
    const background = (label: string) =>
      StyleSheet.flatten(view.getByLabelText(label).props.style).backgroundColor;

    expect(background('Stop 1, Home')).toBe(colors.tint);
    expect(background('Stop 2, Diner')).toBe(colors.card);
    expect(background('Stop 3, Coast')).toBe(colors.tint);
  });

  it('tints a round trip’s destination', async () => {
    const destination = { ...stop(2, 'Coast', 'stop', 45.5, -122.7), isTurnaround: true };
    const view = await render(<StopsMap stops={[stops[0], destination]} />);

    const { backgroundColor } = StyleSheet.flatten(
      view.getByLabelText('Stop 2, Coast').props.style
    );
    expect(backgroundColor).toBe(colors.tint);
  });

  it('opens the stop whose pin is tapped', async () => {
    const onOpenStop = jest.fn();
    const view = await render(<StopsMap stops={stops} onOpenStop={onOpenStop} />);

    await fireEvent.press(view.getByLabelText('Stop 2, Diner'));

    expect(onOpenStop).toHaveBeenCalledWith(stops[1]);
  });

  it('makes the pins untappable without onOpenStop', async () => {
    const view = await render(<StopsMap stops={stops} />);

    expect(view.getByLabelText('Stop 1, Home')).toBeDisabled();
  });
});
