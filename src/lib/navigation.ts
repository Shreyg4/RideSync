/**
 * @file navigation.ts
 * @description Hands a stop to the phone's maps app for turn-by-turn driving directions: Apple Maps
 * on iPhone, Google Maps on Android
 */
import { Linking, Platform } from 'react-native';
import { reportError } from './logger';
import type { Coordinates } from '../types/trip';

// Both are web links that open the maps app when it's installed, and the website when it isn't.
// Each starts from wherever the phone is
export const navigationUrl = ({ lat, lng }: Coordinates, os: string = Platform.OS) =>
  os === 'ios'
    ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

export const openNavigation = (place: Coordinates) =>
  Linking.openURL(navigationUrl(place)).catch((error) =>
    reportError(error, { scope: 'openNavigation' })
  );
