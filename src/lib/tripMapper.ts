/**
 * @file tripMapper.ts
 * @description Turns a trips table row on supabase into the Trip shape the list components render
 */
import type {
  Trip,
  TripType,
  TripMember,
  TripMemberRole,
  SavedTrip,
  TripStop,
  StopType,
  StopCategory,
} from '../types/trip';
import type { TripRow, TripMemberRow, SavedTripRow } from '../services/tripService';
import { avatarUrl } from './avatarStorage';
import { formatShortDate } from './dateTime';
import { tripImageUrl } from './tripImageStorage';
import type { TripStopRow } from '../services/tripStopService';
import type { Json } from '../types/database';

// The trip list's rows carry a member count. A single trip fetched on its own doesn't, and its
// screens read members from list_trip_members instead
export const toTrip = (row: TripRow & { trip_members?: { count: number }[] }): Trip => {
  const startsAt = new Date(row.starts_at);
  return {
    id: row.id,
    numMembers: row.trip_members?.[0]?.count ?? 1,
    image: tripImageUrl(row.image_url),
    name: row.name,
    startsAt,
    departureDate: formatShortDate(startsAt),
    departureTime: startsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    tripType: row.trip_type as TripType,
  };
};

type SavedStopJson = { [key: string]: Json | undefined };

const stringOrNull = (value: Json | undefined) => (typeof value === 'string' ? value : null);

// A saved trip's stops are a json copy of its trip_stops rows, without ids. They're numbered by
// their place in the list so the itinerary can key and look them up like a trip's stops
export const toSavedTripStops = (stops: Json, savedTripId: number): TripStop[] =>
  (Array.isArray(stops) ? stops : [])
    .filter(
      (stop): stop is SavedStopJson =>
        typeof stop === 'object' && stop !== null && !Array.isArray(stop)
    )
    .map((stop, index) => {
      const departsAt = stringOrNull(stop.departs_at);
      return {
        id: index + 1,
        tripId: savedTripId,
        position: index,
        name: stringOrNull(stop.name) ?? '',
        address: stringOrNull(stop.address),
        lat: Number(stop.lat),
        lng: Number(stop.lng),
        mapboxId: stringOrNull(stop.mapbox_id),
        stopType: (stringOrNull(stop.stop_type) ?? 'stop') as StopType,
        stopCategory: (stringOrNull(stop.category) ?? 'other') as StopCategory,
        notes: stringOrNull(stop.notes),
        departsAt: departsAt ? new Date(departsAt) : null,
        isTurnaround: stop.is_turnaround === true,
      };
    });

export const toSavedTrip = (row: SavedTripRow): SavedTrip => {
  return {
    id: row.id,
    image: tripImageUrl(row.image_url),
    imagePath: row.image_url,
    name: row.name,
    tripType: row.trip_type as TripType,
    startsAt: row.starts_at ? new Date(row.starts_at) : null,
    stops: toSavedTripStops(row.stops, row.id),
  };
};

export const toTripMember = (row: TripMemberRow): TripMember => ({
  id: row.user_id,
  name: row.display_name,
  avatar: avatarUrl(row.avatar_path),
  role: row.role as TripMemberRole,
});

export const toTripStop = (row: TripStopRow): TripStop => ({
  id: row.id,
  tripId: row.trip_id,
  position: row.position,
  name: row.name,
  address: row.address,
  lat: row.lat,
  lng: row.lng,
  mapboxId: row.mapbox_id,
  stopType: row.stop_type as StopType,
  stopCategory: row.category as StopCategory,
  notes: row.notes,
  departsAt: row.departs_at ? new Date(row.departs_at) : null,
  isTurnaround: row.is_turnaround,
});
