import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { setAccessToken } from '@rnmapbox/maps';
import { setupMapbox } from '../mapbox';
import { setErrorReporter } from '../logger';

const setAccessTokenMock = setAccessToken as unknown as jest.Mock<() => Promise<string | null>>;
const realToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
let reporter: jest.Mock;

beforeEach(() => {
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN = 'pk.test-token';
  setAccessTokenMock.mockReset();
  setAccessTokenMock.mockResolvedValue(null);
  reporter = jest.fn();
  setErrorReporter(reporter);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN = realToken;
  setErrorReporter(null);
  jest.restoreAllMocks();
});

describe('setupMapbox', () => {
  it('gives the map SDK the token from the environment', () => {
    setupMapbox();

    expect(setAccessTokenMock).toHaveBeenCalledWith('pk.test-token');
    expect(reporter).not.toHaveBeenCalled();
  });

  it('reports a missing token instead of stopping the app', () => {
    delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

    expect(() => setupMapbox()).not.toThrow();

    expect(setAccessTokenMock).not.toHaveBeenCalled();
    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'EXPO_PUBLIC_MAPBOX_TOKEN is not set' }),
      { scope: 'setupMapbox' }
    );
  });

  it('reports the SDK rejecting the token', async () => {
    const failure = new Error('native failure');
    setAccessTokenMock.mockRejectedValue(failure);

    setupMapbox();
    await new Promise(process.nextTick);

    expect(reporter).toHaveBeenCalledWith(failure, { scope: 'setupMapbox' });
  });
});
