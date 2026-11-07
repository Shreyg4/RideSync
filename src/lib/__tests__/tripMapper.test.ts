import { describe, expect, it } from '@jest/globals';
import { toTrip, toTripMember, toTripStop } from '../tripMapper';
import type { TripRow, TripMemberRow } from '@/src/services/tripService';
import { mockBucket } from '@/src/test/supabase';

const NOW = new Date(2026, 8, 2, 9, 30, 0, 0).toISOString();
const PUBLIC_URL = 'https://test.supabase.co/storage/v1/object/public';

const tripRow = (overrides: Partial<TripRow> = {}): TripRow => ({
  created_at: NOW,
  id: 1,
  image_url: 'user-1/1767225600000.png',
  invite_link: 'ABCD2345',
  name: 'Coast Run',
  owner_id: 'user-1',
  starts_at: NOW,
  trip_status: 'planning',
  trip_type: 'one-way',
  updated_at: NOW,
  ...overrides,
});

const memberRow = (overrides: Partial<TripMemberRow> = {}): TripMemberRow => ({
  user_id: 'user-1',
  display_name: 'Ana',
  role: 'owner',
  avatar_path: 'user-1/avatar.png',
  joined_at: NOW,
  ...overrides,
});

describe('toTrip', () => {
  it('copies id and name exactly', () => {
    expect(toTrip(tripRow())).toEqual(expect.objectContaining({ id: 1, name: 'Coast Run' }));
  });

  it('turns the image path into a public URL', () => {
    const trip = toTrip(tripRow({ image_url: 'user-1/abc.jpg' }));

    expect(trip.image).toBe(`${PUBLIC_URL}/trip-images/user-1/abc.jpg`);
  });

  it('returns a null image when there is no image path', () => {
    const trip = toTrip(tripRow({ image_url: null }));

    expect(trip.image).toBeNull();
    expect(mockBucket('trip-images').getPublicUrl).not.toHaveBeenCalled();
  });

  it('passes the trip type through', () => {
    expect(toTrip(tripRow({ trip_type: 'round-trip' })).tripType).toBe('round-trip');
  });

  it('formats the departure date and time in the device locale', () => {
    const startsAt = new Date(2026, 6, 10, 9, 5);
    const trip = toTrip(tripRow({ starts_at: startsAt.toISOString() }));

    // Expected text comes from Intl, not literals, so the test passes in any machine locale
    const date = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

    expect(trip.departureDate).toBe(date.format(startsAt));
    expect(trip.departureTime).toBe(time.format(startsAt));
  });
});

describe('toTripStop', () => {
  const row = {
    id: 3,
    trip_id: 1,
    position: 2,
    name: 'Motel',
    address: '9 Hill Rd',
    lat: 47.6,
    lng: -122.3,
    mapbox_id: 'mapbox-3',
    stop_type: 'overnight',
    category: 'lodging',
    notes: 'Late check-in',
    departs_at: '2026-09-03T15:00:00.000Z',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  it('renames the columns the app reads', () => {
    expect(toTripStop(row)).toEqual({
      id: 3,
      tripId: 1,
      position: 2,
      name: 'Motel',
      address: '9 Hill Rd',
      lat: 47.6,
      lng: -122.3,
      mapboxId: 'mapbox-3',
      stopType: 'overnight',
      stopCategory: 'lodging',
      notes: 'Late check-in',
      departsAt: new Date('2026-09-03T15:00:00.000Z'),
    });
  });

  it('leaves a missing departure time empty rather than the 1970 date', () => {
    expect(toTripStop({ ...row, departs_at: null }).departsAt).toBeNull();
  });
});

describe('toTripMember', () => {
  it('renames user_id and display_name', () => {
    expect(toTripMember(memberRow())).toEqual(
      expect.objectContaining({ id: 'user-1', name: 'Ana' })
    );
  });

  it('passes the role through', () => {
    expect(toTripMember(memberRow({ role: 'editor' })).role).toBe('editor');
  });

  it('turns the avatar path into a public URL', () => {
    expect(toTripMember(memberRow()).avatar).toBe(`${PUBLIC_URL}/avatars/user-1/avatar.png`);
  });

  it('returns a null avatar when there is no avatar path', () => {
    const member = toTripMember(memberRow({ avatar_path: null as unknown as string }));

    expect(member.avatar).toBeNull();
    expect(mockBucket('avatars').getPublicUrl).not.toHaveBeenCalled();
  });
});
