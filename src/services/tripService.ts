/**
 * @file tripService.ts
 * @description The data-access layer for the trip table
 */
import { supabase } from '@/src/lib/supabase';
import type { Database } from '@/src/types/database';

export type TripRow = Database['public']['Tables']['trips']['Row'];
export type NewTrip = Pick<
  Database['public']['Tables']['trips']['Insert'],
  'name' | 'starts_at' | 'trip_type' | 'image_url'
>;

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
