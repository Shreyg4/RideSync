import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import TripMap from '../TripMap';

describe('TripMap', () => {
  it('opens the camera longitude first, the order Mapbox expects', async () => {
    const view = await render(<TripMap initialCenter={{ lat: 47.6, lng: -122.3 }} />);

    expect(view.getByTestId('mapbox-camera').props.defaultSettings.centerCoordinate).toEqual([
      -122.3, 47.6,
    ]);
  });

  it('uses the given zoom, or a default for a city view', async () => {
    const center = { lat: 47.6, lng: -122.3 };

    const zoomedIn = await render(<TripMap initialCenter={center} initialZoom={15} />);
    expect(zoomedIn.getByTestId('mapbox-camera').props.defaultSettings.zoomLevel).toBe(15);

    const byDefault = await render(<TripMap initialCenter={center} />);
    expect(byDefault.getByTestId('mapbox-camera').props.defaultSettings.zoomLevel).toBe(11);
  });

  it('sets no camera without a center', async () => {
    const view = await render(<TripMap />);

    expect(view.queryByTestId('mapbox-camera')).toBeNull();
  });

  it('renders children such as pins inside the map', async () => {
    const view = await render(
      <TripMap testID="map">
        <Text>Pin</Text>
      </TripMap>
    );

    expect(view.getByTestId('map')).toContainElement(view.getByText('Pin'));
  });
});
