import { supabase } from '@/src/lib/supabase';
import type { Database } from '@/src/types/database';

export type TripRow = Database['public']['Tables']['trips']['Row'];
export type NewTrip = Omit<
  Database['public']['Tables']['trips']['Insert'],
  'id' | 'owner_id' | 'created_at' | 'updated_at'
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
  const { data, error } = await supabase.from('trips').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const createTrip = async (trip: NewTrip): Promise<TripRow> => {
  const { data, error } = await supabase.from('trips').insert(trip).select().single();
  if (error) throw error;
  return data;
};
