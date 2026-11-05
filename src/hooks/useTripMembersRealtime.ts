/**
 * @file useTripMembersRealtime.ts
 * @description Keeps a trip screen's member list live. Any join, role change or removal, from any
 * phone, reloads the list. Pass onRemoved to also hear when the signed-in user is taken off the trip
 */
import { useEffect } from 'react';
import { useAuth } from '@/src/context/AuthProvider';
import { subscribeToTripMembers } from '@/src/services/tripService';

// reload and onRemoved must be stable (useAsync's reload is), or the channel reopens every render
export const useTripMembersRealtime = (
  tripId: number,
  reload: () => void,
  onRemoved?: () => void
) => {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!Number.isInteger(tripId)) return;

    return subscribeToTripMembers(tripId, (change) => {
      // Removed, left, or the trip was cancelled: the list can't load anymore, so don't try
      if (change.event === 'DELETE' && change.userId === userId && onRemoved) {
        onRemoved();
        return;
      }
      reload();
    });
  }, [tripId, userId, reload, onRemoved]);
};
