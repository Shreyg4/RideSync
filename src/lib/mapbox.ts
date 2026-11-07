/**
 * @file mapbox.ts
 * @description Gives the Mapbox map SDK its access token. The root layout calls this once at startup,
 * so the token is set before any map renders
 */
import { setAccessToken } from '@rnmapbox/maps';
import { reportError } from './logger';

// A missing token only breaks maps, so this reports it instead of stopping the app like supabase.ts
export const setupMapbox = () => {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    reportError(new Error('EXPO_PUBLIC_MAPBOX_TOKEN is not set'), { scope: 'setupMapbox' });
    return;
  }

  setAccessToken(token).catch((error) => reportError(error, { scope: 'setupMapbox' }));
};
