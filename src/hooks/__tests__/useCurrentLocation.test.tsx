import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useCurrentLocation } from '../useCurrentLocation';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));

const requestPermission = Location.requestForegroundPermissionsAsync as unknown as jest.Mock<
  () => Promise<{ granted: boolean }>
>;
const lastKnown = Location.getLastKnownPositionAsync as unknown as jest.Mock<
  () => Promise<{ coords: { latitude: number; longitude: number } } | null>
>;

const settled = async () => {
  const { result } = await renderHook(() => useCurrentLocation());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current;
};

beforeEach(() => {
  jest.clearAllMocks();
  requestPermission.mockResolvedValue({ granted: true });
  lastKnown.mockResolvedValue({ coords: { latitude: 47.6, longitude: -122.3 } });
});

describe('useCurrentLocation', () => {
  it('returns the last known position once permission is granted', async () => {
    await expect(settled()).resolves.toEqual({
      location: { lat: 47.6, lng: -122.3 },
      loading: false,
    });
  });

  it('never reads the position when permission is denied', async () => {
    requestPermission.mockResolvedValue({ granted: false });

    await expect(settled()).resolves.toEqual({ location: null, loading: false });
    expect(lastKnown).not.toHaveBeenCalled();
  });

  it('settles with no location when the device has no known position', async () => {
    lastKnown.mockResolvedValue(null);

    await expect(settled()).resolves.toEqual({ location: null, loading: false });
  });

  it('settles with no location when location services fail', async () => {
    lastKnown.mockRejectedValue(new Error('Location services are off'));

    await expect(settled()).resolves.toEqual({ location: null, loading: false });
  });
});
