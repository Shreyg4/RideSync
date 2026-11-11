/**
 * @file tripStopService.ts
 * @description The data-access layer for stops in a trip
 */
import { supabase } from '@/src/lib/supabase';
import { assertChanged } from '@/src/services/assertChanged';
import type { Database } from '@/src/types/database';

export type TripStopRow = Database['public']['Tables']['trip_stops']['Row'];
export type NewTripStop = Omit<
  Database['public']['Functions']['add_trip_stop']['Args'],
  'target_trip_id'
>;
export type TripStopChanges = Partial<
  Pick<
    Database['public']['Tables']['trip_stops']['Update'],
    | 'name'
    | 'address'
    | 'lat'
    | 'lng'
    | 'mapbox_id'
    | 'stop_type'
    | 'category'
    | 'notes'
    | 'departs_at'
  >
>;

export const listTripStops = async (tripId: number): Promise<TripStopRow[]> => {
  const { data, error } = await supabase
    .from('trip_stops')
    .select('*')
    .eq('trip_id', tripId)
    .order('position');

  if (error) throw error;
  return data ?? [];
};

export const addTripStop = async (tripId: number, stop: NewTripStop): Promise<TripStopRow> => {
  const { data, error } = await supabase.rpc('add_trip_stop', { target_trip_id: tripId, ...stop });

  if (error) throw error;
  return data;
};

export const updateTripStop = async (stopId: number, changes: TripStopChanges): Promise<void> => {
  const clearsDeparture = changes.stop_type !== undefined && changes.stop_type !== 'overnight';
  const { data, error } = await supabase
    .from('trip_stops')
    .update(clearsDeparture ? { ...changes, departs_at: null } : changes)
    .eq('id', stopId)
    .select('id');

  if (error) throw error;
  assertChanged(data);
};

export const removeTripStop = async (stopId: number): Promise<void> => {
  const { error } = await supabase.rpc('remove_trip_stop', { target_stop_id: stopId });
  if (error?.code === 'P0002') return;
  if (error) throw error;
};

export const reorderTripStops = async (tripId: number, orderedIds: number[]): Promise<void> => {
  const { error } = await supabase.rpc('reorder_trip_stops', {
    target_trip_id: tripId,
    ordered_ids: orderedIds,
  });
  if (error) throw error;
};

// supabase.channel() hands back the open channel when a name is reused, so two screens on the same
// trip would share one and the first to unmount would close it for both
let channelCount = 0;

// Calls onChange whenever a stop in the trip is added, edited, moved or removed. Returns the
// unsubscribe. A deleted row arrives with only its id, so this says that something changed, not what
export const subscribeToTripStops = (tripId: number, onChange: () => void): (() => void) => {
  channelCount += 1;
  const channel = supabase
    .channel(`trip-stops:${tripId}:${channelCount}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trip_stops', filter: `trip_id=eq.${tripId}` },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
