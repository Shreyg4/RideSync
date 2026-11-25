/**
 * @file useKeyStopTaken.ts
 * @description Tells a member picking the start, end or destination when another member sets it
 * first. A trip has only one of each, so their pick could never save
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { keyStopTakenAlert, stopInRole } from '@/src/domain/rules';
import type { KeyStopRole, NextStopType } from '@/src/domain/rules';
import { STOP_CHANGES_SETTLE_MS } from '@/src/hooks/useTripStopsRealtime';
import { reportError } from '@/src/lib/logger';
import { toTripStop } from '@/src/lib/tripMapper';
import { listTripStops, subscribeToTripStops } from '@/src/services/tripStopService';

const isKeyStopRole = (role: NextStopType | null): role is KeyStopRole =>
  role !== null && role !== 'stop';

// role is what the member is picking, or null when they aren't picking a key stop. watching is off
// while their own save runs and after it, so their own stop arriving over Realtime isn't mistaken
// for someone else's. Watches only while the screen is focused, so a screen under another one in
// the stack doesn't alert too.
// Returns a check for after a failed save: true when the role was taken, after telling the member
export const useKeyStopTaken = (tripId: number, role: NextStopType | null, watching: boolean) => {
  const watchingRef = useRef(watching);
  watchingRef.current = watching;
  // One alert per screen: its only button leaves for the planner
  const alerted = useRef(false);

  const check = useCallback(
    async (afterFailedSave: boolean): Promise<boolean> => {
      if (!isKeyStopRole(role) || !Number.isInteger(tripId)) return false;
      if (alerted.current) return true;

      const taken = stopInRole((await listTripStops(tripId)).map(toTripStop), role);
      // A save may have started while the stops loaded
      if (!taken || alerted.current || (!afterFailedSave && !watchingRef.current)) return false;

      alerted.current = true;
      const { title, message } = keyStopTakenAlert(role, taken.name, afterFailedSave);
      Alert.alert(
        title,
        message,
        [{ text: 'View Itinerary', onPress: () => router.dismissTo(`/trips/${tripId}/planner`) }],
        { cancelable: false }
      );
      return true;
    },
    [tripId, role]
  );

  useFocusEffect(
    useCallback(() => {
      if (!isKeyStopRole(role) || !Number.isInteger(tripId)) return;

      const checkLive = () => {
        if (!watchingRef.current) return;
        check(false).catch((error) => reportError(error, { scope: 'useKeyStopTaken' }));
      };

      // It may have been set while this screen was covered
      checkLive();

      let timer: ReturnType<typeof setTimeout> | undefined;
      const unsubscribe = subscribeToTripStops(tripId, () => {
        clearTimeout(timer);
        timer = setTimeout(checkLive, STOP_CHANGES_SETTLE_MS);
      });

      return () => {
        clearTimeout(timer);
        unsubscribe();
      };
    }, [tripId, role, check])
  );

  return useCallback(() => check(true), [check]);
};
