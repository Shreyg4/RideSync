import { describe, expect, it } from '@jest/globals';
import { toTrip, toTripMember } from '../tripMapper';
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
