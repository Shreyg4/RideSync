import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Linking } from 'react-native';
import { navigationUrl, openNavigation } from '../navigation';

const place = { lat: 47.6205, lng: -122.3493 };

describe('navigationUrl', () => {
  it('opens Apple Maps driving directions on iPhone', () => {
    expect(navigationUrl(place, 'ios')).toBe(
      'https://maps.apple.com/?daddr=47.6205,-122.3493&dirflg=d'
    );
  });

  it('opens Google Maps driving directions on Android', () => {
    expect(navigationUrl(place, 'android')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=47.6205,-122.3493&travelmode=driving'
    );
  });
});

describe('openNavigation', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('hands the link to the phone', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    await openNavigation(place);

    expect(openURL).toHaveBeenCalledWith(navigationUrl(place));
  });

  it('doesn’t throw when the phone can’t open it', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no app'));

    await expect(openNavigation(place)).resolves.toBeUndefined();
  });
});
