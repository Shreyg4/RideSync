import { beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import TripMap from '@/src/components/TripMap';
import { MAP_STYLES, resetMapStyleForTests, setMapStyle } from '../mapStyle';

describe('map style', () => {
  beforeEach(async () => {
    resetMapStyleForTests();
    await AsyncStorage.clear();
  });

  it('opens streets when nothing was saved', async () => {
    const view = await render(<TripMap testID="map" />);

    expect(view.getByTestId('map').props.styleURL).toBe(MAP_STYLES.streets.url);
  });

  it('opens on the style saved last time', async () => {
    await AsyncStorage.setItem('settings.mapStyle', 'satellite');
    const view = await render(<TripMap testID="map" />);

    await waitFor(() =>
      expect(view.getByTestId('map').props.styleURL).toBe(MAP_STYLES.satellite.url)
    );
  });

  it('falls back to streets for a saved style no longer offered', async () => {
    await AsyncStorage.setItem('settings.mapStyle', 'light');
    const view = await render(<TripMap testID="map" />);
    await act(async () => {});

    expect(view.getByTestId('map').props.styleURL).toBe(MAP_STYLES.streets.url);
  });

  it('switches open maps at once and saves the choice', async () => {
    const view = await render(<TripMap testID="map" />);

    await act(() => setMapStyle('dark'));

    expect(view.getByTestId('map').props.styleURL).toBe(MAP_STYLES.dark.url);
    expect(await AsyncStorage.getItem('settings.mapStyle')).toBe('dark');
  });
});
