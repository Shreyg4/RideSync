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

  describe('fitTo', () => {
    const seattle = { lat: 47.6, lng: -122.3 };
    const portland = { lat: 45.5, lng: -122.7 };

    it('keeps every place in view, with room for pins at the edges', async () => {
      const view = await render(<TripMap fitTo={[seattle, portland]} />);
      const camera = view.getByTestId('mapbox-camera');

      expect(camera.props.bounds).toEqual({ ne: [-122.3, 47.6], sw: [-122.7, 45.5] });
      expect(camera.props.padding).toEqual({
        paddingTop: 48,
        paddingRight: 48,
        paddingBottom: 48,
        paddingLeft: 48,
      });
    });

    it('centers on a single place at the given zoom', async () => {
      const view = await render(<TripMap fitTo={[seattle]} initialZoom={13} />);
      const camera = view.getByTestId('mapbox-camera');

      expect(camera.props.centerCoordinate).toEqual([-122.3, 47.6]);
      expect(camera.props.zoomLevel).toBe(13);
      expect(camera.props.bounds).toBeUndefined();
    });

    it('keeps the places clear of whatever covers an edge, on top of the usual margin', async () => {
      const view = await render(
        <TripMap fitTo={[seattle, portland]} coveredEdges={{ top: 100 }} />
      );

      expect(view.getByTestId('mapbox-camera').props.padding).toEqual({
        paddingTop: 148,
        paddingRight: 48,
        paddingBottom: 48,
        paddingLeft: 48,
      });
    });

    it('takes a wider margin to zoom further out', async () => {
      const view = await render(<TripMap fitTo={[seattle, portland]} fitMargin={100} />);

      expect(view.getByTestId('mapbox-camera').props.padding).toEqual({
        paddingTop: 100,
        paddingRight: 100,
        paddingBottom: 100,
        paddingLeft: 100,
      });
    });

    it('centers a single place in the part of the map left uncovered', async () => {
      const view = await render(<TripMap fitTo={[seattle]} coveredEdges={{ top: 100 }} />);

      expect(view.getByTestId('mapbox-camera').props.padding).toEqual({
        paddingTop: 100,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
      });
    });

    it('opens with the covered edge already allowed for', async () => {
      const view = await render(
        <TripMap fitTo={[seattle, portland]} coveredEdges={{ top: 100 }} />
      );

      expect(view.getByTestId('mapbox-camera').props.defaultSettings.padding.paddingTop).toBe(148);
    });

    it('opens on the fit, so the camera does not fly in from the whole world', async () => {
      const view = await render(<TripMap fitTo={[seattle, portland]} />);

      expect(view.getByTestId('mapbox-camera').props.defaultSettings.bounds).toEqual({
        ne: [-122.3, 47.6],
        sw: [-122.7, 45.5],
      });
    });

    it('leaves the camera alone when a reload hands in the same places', async () => {
      const view = await render(<TripMap fitTo={[seattle, portland]} />);
      const before = view.getByTestId('mapbox-camera').props.bounds;

      await view.rerender(<TripMap fitTo={[{ ...seattle }, { ...portland }]} />);

      expect(view.getByTestId('mapbox-camera').props.bounds).toBe(before);
    });

    it('moves the camera when a place is added', async () => {
      const view = await render(<TripMap fitTo={[seattle, portland]} />);

      await view.rerender(<TripMap fitTo={[seattle, portland, { lat: 47.7, lng: -117.4 }]} />);

      expect(view.getByTestId('mapbox-camera').props.bounds).toEqual({
        ne: [-117.4, 47.7],
        sw: [-122.7, 45.5],
      });
    });

    it('wins over initialCenter', async () => {
      const view = await render(<TripMap initialCenter={portland} fitTo={[seattle]} />);

      expect(view.getByTestId('mapbox-camera').props.centerCoordinate).toEqual([-122.3, 47.6]);
    });

    it('falls back to initialCenter when there are no places yet', async () => {
      const view = await render(<TripMap initialCenter={portland} fitTo={[]} />);

      expect(view.getByTestId('mapbox-camera').props.defaultSettings.centerCoordinate).toEqual([
        -122.7, 45.5,
      ]);
    });
  });
});
