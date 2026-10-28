/**
 * @file tripMapper.ts
 * @description Turns a trips table row on supabase into the Trip shape the list components render
 */
import type { Trip, TripType, TripMember, TripMemberRole, SavedTrip } from '../types/trip';
import type { TripRow, TripMemberRow, SavedTripRow } from '../services/tripService';
import { avatarUrl } from './avatarStorage';
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

export const toSavedTrip = (row: SavedTripRow): SavedTrip => {
  return {
    id: row.id,
    image: tripImageUrl(row.image_url),
    imagePath: row.image_url,
    name: row.name,
    tripType: row.trip_type as TripType,
  };
};

export const toTripMember = (row: TripMemberRow): TripMember => ({
  id: row.user_id,
  name: row.display_name,
  avatar: avatarUrl(row.avatar_path),
  role: row.role as TripMemberRole,
});
