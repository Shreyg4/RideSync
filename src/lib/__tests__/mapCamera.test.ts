import { describe, expect, it } from '@jest/globals';
import { cameraFit } from '../mapCamera';

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
