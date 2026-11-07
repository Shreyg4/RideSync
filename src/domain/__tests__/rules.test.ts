import { describe, expect, it } from '@jest/globals';
import type { StopType, TripMember, TripMemberRole } from '@/src/types/trip';
import {
  nextOwner,
  memberRoleLabel,
  formatJoinCode,
  tripTypeLabel,
  tripStatusLabel,
  toStopCategory,
  nextStopType,
  addStopLabel,
  stopLabel,
} from '../rules';

const member = (name: string, role: TripMemberRole): TripMember => ({
  id: name.toLowerCase(),
  name,
  avatar: null,
  role,
});

describe('nextOwner', () => {
  it('picks the first editor even when a viewer joined earlier', () => {
    const members = [
      member('Ana', 'owner'),
      member('Bea', 'viewer'),
      member('Cal', 'editor'),
      member('Sam', 'editor'),
    ];
    expect(nextOwner(members)?.name).toBe('Cal');
  });

  it('falls back to the first viewer when there are no editors', () => {
    const members = [member('Ana', 'owner'), member('Bea', 'viewer'), member('cal', 'viewer')];
    expect(nextOwner(members)?.name).toBe('Bea');
  });

  it('returns undefined for an owner-only list or an empty list', () => {
    expect(nextOwner([member('Ana', 'owner')])).toBeUndefined();
    expect(nextOwner([])).toBeUndefined();
  });
});

describe('nextStopType', () => {
  const stops = (...types: StopType[]) => types.map((stopType) => ({ stopType }));

  it('starts every trip with the start', () => {
    expect(nextStopType([], 'one-way')).toBe('start');
    expect(nextStopType([], 'round-trip')).toBe('start');
  });

  it('asks a one-way trip for its end next', () => {
    expect(nextStopType(stops('start'), 'one-way')).toBe('end');
  });

  it('adds normal stops once a one-way trip has both ends', () => {
    expect(nextStopType(stops('start', 'end'), 'one-way')).toBe('stop');
    expect(nextStopType(stops('start', 'overnight', 'end'), 'one-way')).toBe('stop');
  });

  it('never asks a round trip for an end, because it finishes at the start', () => {
    expect(nextStopType(stops('start'), 'round-trip')).toBe('stop');
  });

  it('asks for the start even if an end already exists', () => {
    expect(nextStopType(stops('end'), 'one-way')).toBe('start');
  });
});

describe('addStopLabel', () => {
  it('names what the button will add', () => {
    expect(addStopLabel('start')).toBe('Set start');
    expect(addStopLabel('end')).toBe('Set end');
    expect(addStopLabel('stop')).toBe('Add stop');
  });
});

describe('stopLabel', () => {
  it('describes a normal stop by its category', () => {
    expect(stopLabel({ stopType: 'stop', stopCategory: 'coffee' })).toBe('Coffee');
  });

  it('describes start, end and overnight stops by their place in the trip', () => {
    expect(stopLabel({ stopType: 'start', stopCategory: 'lodging' })).toBe('Start');
    expect(stopLabel({ stopType: 'end', stopCategory: 'lodging' })).toBe('End');
    expect(stopLabel({ stopType: 'overnight', stopCategory: 'lodging' })).toBe('Overnight');
  });
});

// These id lists are what Mapbox returned for real places
describe('toStopCategory', () => {
  it.each([
    ['a gas station', ['gas_station'], 'gas'],
    ['an EV charger', ['charging_station', 'transportation'], 'gas'],
    ['a hotel', ['hotel', 'lodging'], 'lodging'],
    ['a rest area', ['rest_area', 'transportation'], 'rest'],
    ['a restaurant', ['restaurant', 'food', 'food_and_drink'], 'food'],
    ['a national park', ['national_park', 'outdoors', 'park'], 'attraction'],
    ['a tourist attraction', ['tourist_attraction'], 'attraction'],
  ])('maps %s', (_, ids, expected) => {
    expect(toStopCategory(ids)).toBe(expected);
  });

  it('calls a coffee shop coffee even though it is also tagged food', () => {
    const starbucks = ['bakery', 'cafe', 'coffee', 'coffee_shop', 'food', 'food_and_drink'];
    expect(toStopCategory(starbucks)).toBe('coffee');
  });

  it('calls a hotel lodging even if it is also tagged food', () => {
    expect(toStopCategory(['food', 'restaurant', 'hotel', 'lodging'])).toBe('lodging');
  });

  it('matches whole ids only, so a hotel bar is not lodging', () => {
    expect(toStopCategory(['hotel_bar'])).toBe('other');
  });

  it.each([
    ['an unrelated id', ['auto_repair', 'services']],
    ['an empty list', []],
    ['no list', undefined],
  ])('falls back to other for %s', (_, ids) => {
    expect(toStopCategory(ids)).toBe('other');
  });
});

describe('memberRoleLabel', () => {
  it('capitalizes each role', () => {
    expect(memberRoleLabel('owner')).toBe('Owner');
    expect(memberRoleLabel('editor')).toBe('Editor');
    expect(memberRoleLabel('viewer')).toBe('Viewer');
  });
});

describe('formatJoinCode', () => {
  it('Adds dash after the 4th character', () => {
    expect(formatJoinCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });

  it('leaves a code of 4 characters or fewer unchanged', () => {
    expect(formatJoinCode('ABCD')).toBe('ABCD');
    expect(formatJoinCode('AB')).toBe('AB');
    expect(formatJoinCode('')).toBe('');
  });
});

describe('tripTypeLabel', () => {
  it('Capitalizes trip type', () => {
    expect(tripTypeLabel('one-way')).toBe('One-way');
    expect(tripTypeLabel('round-trip')).toBe('Round-trip');
  });
});

describe('tripStatusLabel', () => {
  it('Formats trip status label to be capitlized and replace dash with a space', () => {
    expect(tripStatusLabel('in-trip')).toBe('In trip');
  });

  it('capitalizes statuses that have no dash', () => {
    expect(tripStatusLabel('planning')).toBe('Planning');
    expect(tripStatusLabel('completed')).toBe('Completed');
  });
});
