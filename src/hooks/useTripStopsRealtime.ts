/**
 * @file useTripStopsRealtime.ts
 * @description Keeps a trip screen's stops live. Any stop added, edited, moved or removed on any
 * phone reloads the screen's stops
 */
import { useEffect } from 'react';
import { subscribeToTripStops } from '@/src/services/tripStopService';

// Adding a stop shifts every stop after it, and Realtime sends one event per changed row, so a
// single add arrives as a burst. Waiting for the burst to end reloads once instead of once per row
export const STOP_CHANGES_SETTLE_MS = 300;

// reload must be stable (useAsync's reload is), or the channel reopens every render
export const useTripStopsRealtime = (tripId: number, reload: () => void) => {
  useEffect(() => {
    if (!Number.isInteger(tripId)) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToTripStops(tripId, () => {
      clearTimeout(timer);
      timer = setTimeout(reload, STOP_CHANGES_SETTLE_MS);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [tripId, reload]);
};
