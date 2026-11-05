/**
 * @file tripService.ts
 * @description The data-access layer for the trip table
 */
import { supabase } from '@/src/lib/supabase';
import { assertChanged } from '@/src/services/assertChanged';
import type { Database } from '@/src/types/database';
import type { TripMemberRole } from '../types/trip';

export type TripRow = Database['public']['Tables']['trips']['Row'];
export type NewTrip = Pick<
  Database['public']['Tables']['trips']['Insert'],
  'name' | 'starts_at' | 'trip_type' | 'image_url'
>;
export type SavedTripRow = Database['public']['Tables']['saved_trips']['Row'];

export const listTrips = async (): Promise<TripRow[]> => {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data;
};

export const getTrip = async (id: number): Promise<TripRow | null> => {
  const { data, error } = await supabase.from('trips').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
};

export const listSavedTrips = async (): Promise<SavedTripRow[]> => {
  const { data, error } = await supabase
    .from('saved_trips')
    .select('*')
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getSavedTrip = async (id: number): Promise<SavedTripRow | null> => {
  const { data, error } = await supabase.from('saved_trips').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
};

export const createTrip = async (trip: NewTrip): Promise<TripRow> => {
  const { data, error } = await supabase.from('trips').insert(trip).select().single();
  if (error) throw error;
  return data;
};

export const joinTrip = async (code: string): Promise<number | null> => {
  const { data, error } = await supabase.rpc('join_trip', { code });
  if (error?.code === 'P0002') return null;
  if (error) throw error;
  return data;
};

export type TripMemberRow = Database['public']['Functions']['list_trip_members']['Returns'][number];

// Everyone on the trip, owner first, then in the order they joined
export const listTripMembers = async (tripId: number): Promise<TripMemberRow[]> => {
  const { data, error } = await supabase.rpc('list_trip_members', { target_trip_id: tripId });
  if (error) throw error;
  return data ?? [];
};

export type TripMemberChange = {
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  userId?: string;
};

// supabase.channel() hands back the open channel when a name is reused, so two screens on the same
// trip would share one and the first to unmount would close it for both
let channelCount = 0;

// Calls onChange whenever someone on the trip joins, changes role or leaves. Returns the unsubscribe
export const subscribeToTripMembers = (
  tripId: number,
  onChange: (change: TripMemberChange) => void
): (() => void) => {
  channelCount += 1;
  const channel = supabase
    .channel(`trip-members:${tripId}:${channelCount}`)
    .on<Database['public']['Tables']['trip_members']['Row']>(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}` },
      (payload) =>
        onChange({
          event: payload.eventType,
          userId: payload.eventType === 'DELETE' ? payload.old.user_id : payload.new.user_id,
        })
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const setMemberRole = async (
  tripId: number,
  userId: string,
  role: Exclude<TripMemberRole, 'owner'>
): Promise<void> => {
  const { data, error } = await supabase
    .from('trip_members')
    .update({ role })
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) throw error;
  assertChanged(data);
};

export const removeTripMember = async (tripId: number, userId: string): Promise<void> => {
  const { data, error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) throw error;
  assertChanged(data);
};

// The old owner stays on as an editor
export const transferTripOwnership = async (tripId: number, newOwnerId: string): Promise<void> => {
  const { error } = await supabase.rpc('transfer_trip_ownership', {
    target_trip_id: tripId,
    new_owner_id: newOwnerId,
  });
  if (error) throw error;
};

// An owner's trip passes to the next member, or is deleted if they were the last one
export const leaveTrip = async (tripId: number): Promise<void> => {
  const { error } = await supabase.rpc('leave_trip', { target_trip_id: tripId });
  if (error) throw error;
};

// Ends the trip for everyone, leaving each member a copy in Saved Trips
export const cancelTrip = async (tripId: number): Promise<void> => {
  const { error } = await supabase.rpc('cancel_trip', { target_trip_id: tripId });
  if (error) throw error;
};

// Ends the trip for everyone with no saved copies
export const deleteTrip = async (tripId: number): Promise<void> => {
  const { data, error } = await supabase.from('trips').delete().eq('id', tripId).select('id');
  if (error) throw error;
  assertChanged(data);
};

// Ends the trip for everyone with no saved copies
export const deleteSavedTrip = async (tripId: number): Promise<void> => {
  const { data, error } = await supabase.from('saved_trips').delete().eq('id', tripId).select('id');
  if (error) throw error;
  assertChanged(data);
};

export const updateTrip = async (id: number, changes: Partial<NewTrip>): Promise<void> => {
  const { data, error } = await supabase.from('trips').update(changes).eq('id', id).select('id');
  if (error) throw error;
  assertChanged(data);
};
