/**
 * @file tripMapper.ts
 * @description Turns a trips table row on supabase into the Trip shape the list components render
 */
import type { Trip, TripType } from '../types/trip';
import type { TripRow } from '../services/tripService';
import { tripImageUrl } from './tripImageStorage';

export const toTrip = (row: TripRow): Trip => {
  const startsAt = new Date(row.starts_at);
  return {
    id: row.id,
    numMembers: 1,
    image: tripImageUrl(row.image_url),
    name: row.name,
    departureDate: startsAt.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    departureTime: startsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    tripType: row.trip_type as TripType,
  };
};
