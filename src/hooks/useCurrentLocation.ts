/**
 * @file useCurrentLocation.ts
 * @description Finds the device once, to center a map and bias search results. Location is only a
 * convenience here, so a denied permission or no known position just leaves it null
 */
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { Coordinates } from '@/src/types/trip';

export const useCurrentLocation = () => {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const locate = async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        // The last known position answers right away, where a fresh fix can take many seconds
        const position = granted ? await Location.getLastKnownPositionAsync() : null;
        if (active && position) {
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        }
      } catch {
        // Location services being off is normal, not an error worth reporting
      } finally {
        if (active) setLoading(false);
      }
    };

    locate();
    return () => {
      active = false;
    };
  }, []);

  return { location, loading };
};
