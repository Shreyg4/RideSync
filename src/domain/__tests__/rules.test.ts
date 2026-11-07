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
  canStayOvernight,
  startsReturnLeg,
  parseNextStopType,
  parseStopPosition,
  stopCategoryLabel,
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

describe('parseNextStopType', () => {
  it.each(['start', 'end', 'destination', 'stop'])('keeps %s', (value) => {
    expect(parseNextStopType(value)).toBe(value);
  });

  it.each([
    ['nothing', undefined],
    ['a repeated param', ['start', 'end']],
    ['overnight, which is chosen later, not searched for', 'overnight'],
    ['an unknown value', 'nope'],
  ])('treats %s as a normal stop', (_, value) => {
    expect(parseNextStopType(value)).toBe('stop');
  });
});

describe('parseStopPosition', () => {
  it.each([
    ['0', 0],
    ['3', 3],
  ])('reads %s as a position', (value, expected) => {
    expect(parseStopPosition(value)).toBe(expected);
  });

  it.each([[undefined], [''], ['soon'], ['-1'], ['1.5'], [['1', '2']]])(
    'has no position for %j',
    (value) => {
      expect(parseStopPosition(value)).toBeUndefined();
    }
  );
});

describe('stopCategoryLabel', () => {
  it('capitalizes the category', () => {
    expect(stopCategoryLabel('attraction')).toBe('Attraction');
  });
});

describe('nextStopType', () => {
  const stops = (...types: StopType[]) =>
    types.map((stopType) => ({ stopType, isTurnaround: false }));
  const destination = { stopType: 'stop' as const, isTurnaround: true };

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

  it('asks a round trip for its destination instead of an end', () => {
    expect(nextStopType(stops('start'), 'round-trip')).toBe('destination');
  });

  it('adds normal stops once a round trip has its destination', () => {
    expect(nextStopType([...stops('start'), destination], 'round-trip')).toBe('stop');
  });

  it('asks again for a destination after the old one is removed, even with other stops left', () => {
    expect(nextStopType(stops('start', 'stop', 'overnight'), 'round-trip')).toBe('destination');
  });

  it('asks for the start even if an end already exists', () => {
    expect(nextStopType(stops('end'), 'one-way')).toBe('start');
  });
});

describe('addStopLabel', () => {
  it('names what the button will add', () => {
    expect(addStopLabel('start')).toBe('Set start');
    expect(addStopLabel('end')).toBe('Set end');
    expect(addStopLabel('destination')).toBe('Set destination');
    expect(addStopLabel('stop')).toBe('Add stop');
  });
});

describe('stopLabel', () => {
  it('describes a normal stop by its category', () => {
    expect(stopLabel({ stopType: 'stop', stopCategory: 'coffee', isTurnaround: false })).toBe(
      'Coffee'
    );
  });

  it('describes start, end and overnight stops by their place in the trip', () => {
    const label = (stopType: StopType) =>
      stopLabel({ stopType, stopCategory: 'lodging', isTurnaround: false });

    expect(label('start')).toBe('Start');
    expect(label('end')).toBe('End');
    expect(label('overnight')).toBe('Overnight');
  });

  it('calls out the destination, and whether the group sleeps there', () => {
    const label = (stopType: StopType) =>
      stopLabel({ stopType, stopCategory: 'food', isTurnaround: true });

    expect(label('stop')).toBe('Destination');
    expect(label('overnight')).toBe('Destination (overnight)');
  });
});

describe('canStayOvernight', () => {
  it('allows a night at a normal stop or the destination', () => {
    expect(canStayOvernight('stop')).toBe(true);
    expect(canStayOvernight('destination')).toBe(true);
  });

  it('does not allow one at the start or end', () => {
    expect(canStayOvernight('start')).toBe(false);
    expect(canStayOvernight('end')).toBe(false);
  });
});

describe('startsReturnLeg', () => {
  const stops = [false, true, false, false].map((isTurnaround) => ({ isTurnaround }));

  it('is true only for the stop right after the destination', () => {
    expect(stops.map((_, index) => startsReturnLeg(stops, index))).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it('is false everywhere on a trip with no destination', () => {
    const oneWay = [{ isTurnaround: false }, { isTurnaround: false }];

    expect(oneWay.map((_, index) => startsReturnLeg(oneWay, index))).toEqual([false, false]);
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
