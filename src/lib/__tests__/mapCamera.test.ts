import { describe, expect, it } from '@jest/globals';
import { areaAround, areaFromBounds, cameraFit } from '../mapCamera';

const seattle = { lat: 47.6, lng: -122.3 };
const portland = { lat: 45.5, lng: -122.7 };
const spokane = { lat: 47.7, lng: -117.4 };

describe('cameraFit', () => {
  it('has nothing to fit with no places', () => {
    expect(cameraFit([])).toBeNull();
  });

  it('centers on a single place, longitude first', () => {
    expect(cameraFit([seattle])).toEqual({ kind: 'center', center: [-122.3, 47.6] });
  });

  it('centers on places at the same spot instead of zooming in as far as it can', () => {
    expect(cameraFit([seattle, { ...seattle }])).toEqual({
      kind: 'center',
      center: [-122.3, 47.6],
    });
  });

  it('bounds several places by their north-east and south-west corners', () => {
    expect(cameraFit([seattle, portland, spokane])).toEqual({
      kind: 'bounds',
      ne: [-117.4, 47.7],
      sw: [-122.7, 45.5],
    });
  });

  it('gives the same fit whatever order the places come in', () => {
    expect(cameraFit([spokane, seattle, portland])).toEqual(
      cameraFit([seattle, portland, spokane])
    );
  });
});

describe('areaAround', () => {
  it('orders the box west, south, east, north, the way Mapbox takes it', () => {
    const [west, south, east, north] = areaAround(seattle, 15).bbox;

    expect(west).toBeLessThan(seattle.lng);
    expect(east).toBeGreaterThan(seattle.lng);
    expect(south).toBeLessThan(seattle.lat);
    expect(north).toBeGreaterThan(seattle.lat);
  });

  it('reaches about the given distance north and south', () => {
    const [, south, , north] = areaAround(seattle, 15).bbox;

    // A degree of latitude is about 111 km anywhere
    expect((north - seattle.lat) * 111.32).toBeCloseTo(15, 5);
    expect((seattle.lat - south) * 111.32).toBeCloseTo(15, 5);
  });

  it('takes more degrees of longitude further from the equator, where each covers less ground', () => {
    const equator = areaAround({ lat: 0, lng: 0 }, 15).bbox;
    const north = areaAround(seattle, 15).bbox;

    expect(north[2] - north[0]).toBeGreaterThan(equator[2] - equator[0]);
  });

  it('keeps the box on the map near the poles and the date line', () => {
    const [west, south, east, north] = areaAround({ lat: 89.99, lng: 179.99 }, 50).bbox;

    expect(north).toBeLessThanOrEqual(90);
    expect(east).toBeLessThanOrEqual(180);
    expect(south).toBeGreaterThanOrEqual(-90);
    expect(west).toBeGreaterThanOrEqual(-180);
  });

  it('ranks results from the center it was given', () => {
    expect(areaAround(seattle, 15).center).toEqual(seattle);
  });
});

describe('areaFromBounds', () => {
  it('turns the map’s northeast and southwest corners into a west, south, east, north box', () => {
    const area = areaFromBounds({ ne: [-122.2, 47.7], sw: [-122.4, 47.5] }, [-122.3, 47.6]);

    expect(area).toEqual({
      bbox: [-122.4, 47.5, -122.2, 47.7],
      center: { lat: 47.6, lng: -122.3 },
    });
  });
});
