import { describe, expect, it } from '@jest/globals';
import type { StopType, TripMember, TripMemberRole, TripStop, TripType } from '@/src/types/trip';
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
  isKeyStop,
  itineraryRows,
  dayHeadingLabel,
  previewRows,
  timeline,
  parseNextStopType,
  parseStopPosition,
  stopCategoryLabel,
  stopLabel,
  stopRole,
  canRemoveStop,
  stopArrivalDay,
  earliestDepartureDay,
  defaultDeparture,
} from '../rules';
import type { ItineraryRow } from '../rules';

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

describe('stopRole', () => {
  it.each<[StopType, boolean, string]>([
    ['start', false, 'start'],
    ['end', false, 'end'],
    ['stop', false, 'stop'],
    ['overnight', false, 'stop'],
    ['stop', true, 'destination'],
    ['overnight', true, 'destination'],
  ])('calls a %s stop (turnaround: %s) a %s', (stopType, isTurnaround, expected) => {
    expect(stopRole({ stopType, isTurnaround })).toBe(expected);
  });
});

describe('canRemoveStop', () => {
  it.each<[string, StopType, boolean, boolean]>([
    ['a normal stop', 'stop', false, true],
    ['an overnight stop', 'overnight', false, true],
    ['the start', 'start', false, false],
    ['the end', 'end', false, false],
    ['the destination', 'stop', true, false],
    ['an overnight destination', 'overnight', true, false],
  ])('%s: %s', (_, stopType, isTurnaround, expected) => {
    expect(canRemoveStop({ stopType, isTurnaround })).toBe(expected);
  });
});

describe('stopArrivalDay', () => {
  const day = (n: number, date: Date): ItineraryRow => ({
    kind: 'dayHeading',
    day: n,
    date,
    startsReturn: false,
  });
  const stopRow = (id: number): ItineraryRow =>
    ({ kind: 'stop', stop: { id } as TripStop }) as ItineraryRow;
  const SEP_2 = new Date(2026, 8, 2);
  const SEP_3 = new Date(2026, 8, 3);
  const rows = [day(1, SEP_2), stopRow(1), stopRow(2), day(2, SEP_3), stopRow(3)];

  it('gives the day of the heading above the stop', () => {
    expect(stopArrivalDay(rows, 1)).toBe(SEP_2);
    expect(stopArrivalDay(rows, 2)).toBe(SEP_2);
    expect(stopArrivalDay(rows, 3)).toBe(SEP_3);
  });

  it('gives the arrival day for an overnight stop, not the day after it', () => {
    // The heading below an overnight stop is the next day, and belongs to the stops after it
    expect(stopArrivalDay([day(1, SEP_2), stopRow(1), day(2, SEP_3)], 1)).toBe(SEP_2);
  });

  it('gives nothing for a stop that is not listed', () => {
    expect(stopArrivalDay(rows, 99)).toBeUndefined();
  });
});

describe('earliestDepartureDay and defaultDeparture', () => {
  const ARRIVAL = new Date(2026, 8, 2, 18, 45);

  it('lets the group leave from the next calendar day on', () => {
    expect(earliestDepartureDay(ARRIVAL)).toEqual(new Date(2026, 8, 3));
  });

  it('suggests leaving the next morning', () => {
    expect(defaultDeparture(ARRIVAL)).toEqual(new Date(2026, 8, 3, 9, 0));
  });

  it('moves to the next month at the end of one', () => {
    expect(defaultDeparture(new Date(2026, 8, 30))).toEqual(new Date(2026, 9, 1, 9, 0));
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

describe('isKeyStop', () => {
  it('picks out the start, end and destination', () => {
    expect(isKeyStop({ stopType: 'start', isTurnaround: false })).toBe(true);
    expect(isKeyStop({ stopType: 'end', isTurnaround: false })).toBe(true);
    expect(isKeyStop({ stopType: 'stop', isTurnaround: true })).toBe(true);
    expect(isKeyStop({ stopType: 'overnight', isTurnaround: true })).toBe(true);
  });

  it('leaves out normal and overnight stops along the way', () => {
    expect(isKeyStop({ stopType: 'stop', isTurnaround: false })).toBe(false);
    expect(isKeyStop({ stopType: 'overnight', isTurnaround: false })).toBe(false);
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

describe('itineraryRows', () => {
  // Wed, Sep 2 2026
  const STARTS_AT = new Date(2026, 8, 2, 9, 30);

  const tripStop = (
    id: number,
    stopType: StopType,
    isTurnaround = false,
    departsAt: Date | null = null
  ): TripStop => ({
    id,
    tripId: 1,
    position: id - 1,
    name: `Stop ${id}`,
    address: null,
    lat: 47.6,
    lng: -122.3,
    mapboxId: null,
    stopType,
    stopCategory: 'other',
    notes: null,
    departsAt,
    isTurnaround,
  });

  const rowsFor = (
    stops: TripStop[],
    tripType: TripType = 'round-trip',
    canAdd = true,
    startsAt = STARTS_AT
  ) => itineraryRows(stops, tripType, startsAt, canAdd);

  // Each row as a short tag, so the order is easy to read
  const shape = (rows: ReturnType<typeof itineraryRows>) =>
    rows.map((row) => {
      switch (row.kind) {
        case 'stop':
          return row.stop.id;
        case 'dayHeading':
          return `Day ${row.day} ${row.date.getMonth() + 1}/${row.date.getDate()}${
            row.startsReturn ? ' Return' : ''
          }`;
        case 'add':
          return row.atPosition === undefined ? row.label : `${row.label} @${row.atPosition}`;
        case 'returnHeading':
          return 'Return';
        case 'backToStart':
          return `back to ${row.stop.id}`;
      }
    });

  it('has only the Set start button for a new trip', () => {
    expect(shape(rowsFor([], 'one-way'))).toEqual(['Set start']);
    expect(shape(rowsFor([], 'round-trip'))).toEqual(['Set start']);
  });

  it('asks for the end or destination at the bottom while it is missing', () => {
    expect(shape(rowsFor([tripStop(1, 'start')], 'one-way'))).toEqual(['Day 1 9/2', 1, 'Set end']);
    expect(shape(rowsFor([tripStop(1, 'start')], 'round-trip'))).toEqual([
      'Day 1 9/2',
      1,
      'Set destination',
      'back to 1',
    ]);
  });

  it('puts the add button just before a one-way trip’s end', () => {
    const stops = [tripStop(1, 'start'), tripStop(2, 'stop'), tripStop(3, 'end')];

    expect(shape(rowsFor(stops, 'one-way'))).toEqual(['Day 1 9/2', 1, 2, 'Add stop', 3]);
  });

  it('splits a round trip into the way out and the drive home, finishing at the start', () => {
    const stops = [tripStop(1, 'start'), tripStop(2, 'stop', true), tripStop(3, 'stop')];

    expect(shape(rowsFor(stops))).toEqual([
      'Day 1 9/2',
      1,
      'Add stop',
      2,
      'Return',
      3,
      'Add return stop @3',
      'back to 1',
    ]);
  });

  it('adds return stops after the last one, even before any exist', () => {
    const stops = [tripStop(1, 'start'), tripStop(2, 'stop', true)];

    expect(shape(rowsFor(stops))).toEqual([
      'Day 1 9/2',
      1,
      'Add stop',
      2,
      'Return',
      'Add return stop @2',
      'back to 1',
    ]);
  });

  it('asks again at the bottom for a destination after the old one is removed', () => {
    const stops = [tripStop(1, 'start'), tripStop(2, 'stop')];

    expect(shape(rowsFor(stops))).toEqual(['Day 1 9/2', 1, 2, 'Set destination', 'back to 1']);
  });

  it('leaves every button out for someone who cannot add stops', () => {
    const stops = [tripStop(1, 'start'), tripStop(2, 'stop', true), tripStop(3, 'stop')];

    expect(shape(rowsFor(stops, 'round-trip', false))).toEqual([
      'Day 1 9/2',
      1,
      2,
      'Return',
      3,
      'back to 1',
    ]);
    expect(shape(rowsFor([], 'one-way', false))).toEqual([]);
  });

  it('starts a new day after each overnight stop', () => {
    const stops = [
      tripStop(1, 'start'),
      tripStop(2, 'overnight'),
      tripStop(3, 'stop'),
      tripStop(4, 'overnight'),
      tripStop(5, 'end'),
    ];

    expect(shape(rowsFor(stops, 'one-way', false))).toEqual([
      'Day 1 9/2',
      1,
      2,
      'Day 2 9/3',
      3,
      4,
      'Day 3 9/4',
      5,
    ]);
  });

  it('puts the return on the next day when the group sleeps at the destination', () => {
    const stops = [tripStop(1, 'start'), tripStop(2, 'overnight', true), tripStop(3, 'stop')];

    expect(shape(rowsFor(stops, 'round-trip', false))).toEqual([
      'Day 1 9/2',
      1,
      2,
      'Day 2 9/3 Return',
      3,
      'back to 1',
    ]);
  });

  it('follows a departure date, so a two-night stay skips a day', () => {
    const stops = [
      tripStop(1, 'start'),
      tripStop(2, 'overnight', false, new Date(2026, 8, 4, 8)),
      tripStop(3, 'end'),
    ];

    expect(shape(rowsFor(stops, 'one-way', false))).toEqual(['Day 1 9/2', 1, 2, 'Day 3 9/4', 3]);
  });

  it('ignores a departure that is not after the day the group arrived', () => {
    const stops = [
      tripStop(1, 'start'),
      tripStop(2, 'overnight', false, new Date(2026, 8, 2, 23)),
      tripStop(3, 'end'),
    ];

    expect(shape(rowsFor(stops, 'one-way', false))).toEqual(['Day 1 9/2', 1, 2, 'Day 2 9/3', 3]);
  });

  it('carries the dates into the next month and year', () => {
    const stops = [tripStop(1, 'start'), tripStop(2, 'overnight'), tripStop(3, 'end')];
    const rows = rowsFor(stops, 'one-way', false, new Date(2026, 11, 31, 22));

    expect(shape(rows)).toEqual(['Day 1 12/31', 1, 2, 'Day 2 1/1', 3]);
    const lastDay = rows.find((row) => row.kind === 'dayHeading' && row.day === 2);
    expect(lastDay?.kind === 'dayHeading' && lastDay.date.getFullYear()).toBe(2027);
  });

  it('has no back-to-start row until a round trip has a start', () => {
    expect(shape(rowsFor([], 'round-trip', false))).toEqual([]);
  });
});

describe('previewRows', () => {
  const place = (id: number): ItineraryRow => ({
    kind: 'stop',
    stop: { id } as TripStop,
  });
  const heading = (day: number): ItineraryRow => ({
    kind: 'dayHeading',
    day,
    date: new Date(2026, 8, day + 1),
    startsReturn: false,
  });
  const ids = (rows: ItineraryRow[]) =>
    rows.map((row) => (row.kind === 'stop' ? row.stop.id : row.kind));

  it('keeps a list that is short enough whole', () => {
    const rows = [heading(1), place(1), place(2), place(3), place(4), place(5)];

    expect(previewRows(rows, 5)).toEqual({ rows, hiddenStops: 0 });
  });

  it('cuts a longer list to one place under the max and counts the stops left out', () => {
    const rows = [heading(1), ...[1, 2, 3, 4, 5, 6, 7].map(place)];

    const preview = previewRows(rows, 5);

    expect(ids(preview.rows)).toEqual(['dayHeading', 1, 2, 3, 4]);
    expect(preview.hiddenStops).toBe(3);
  });

  it('counts the return to the start as a place but not as a hidden stop', () => {
    const start = place(1);
    const rows = [
      ...[1, 2, 3, 4, 5].map(place),
      { kind: 'backToStart', stop: (start as { stop: TripStop }).stop } as ItineraryRow,
    ];

    const preview = previewRows(rows, 5);

    expect(ids(preview.rows)).toEqual([1, 2, 3, 4]);
    expect(preview.hiddenStops).toBe(1);
  });

  it('drops a heading left at the bottom with nothing under it', () => {
    const rows = [place(1), place(2), place(3), place(4), heading(2), place(5), place(6)];

    expect(ids(previewRows(rows, 5).rows)).toEqual([1, 2, 3, 4]);
  });
});

describe('timeline', () => {
  const place = { kind: 'stop', stop: { id: 1 } as TripStop } as ItineraryRow;
  const heading = { kind: 'returnHeading' } as ItineraryRow;
  const add = { kind: 'add', stopType: 'stop', label: 'Add stop' } as ItineraryRow;
  const lines = (rows: ItineraryRow[]) =>
    timeline(rows).map(({ lineAbove, lineBelow }) => `${+lineAbove}${+lineBelow}`);

  it('runs from the first place to the last, through the rows between', () => {
    expect(lines([heading, place, add, place, heading, place, add])).toEqual([
      '00',
      '01',
      '11',
      '11',
      '11',
      '10',
      '00',
    ]);
  });

  it('starts a new line each day, with none through the day heading', () => {
    const day = (n: number) =>
      ({ kind: 'dayHeading', day: n, date: new Date(), startsReturn: false }) as ItineraryRow;

    expect(lines([day(1), place, place, day(2), place, heading, place, add, place])).toEqual([
      '00',
      '01',
      '10',
      '00',
      '01',
      '11',
      '11',
      '11',
      '10',
    ]);
  });

  it('leaves a day with one place without a line', () => {
    const day = {
      kind: 'dayHeading',
      day: 2,
      date: new Date(),
      startsReturn: false,
    } as ItineraryRow;

    expect(lines([place, place, day, place, add])).toEqual(['01', '10', '00', '00', '00']);
  });

  it('draws no line for a single place or none', () => {
    expect(lines([heading, place, add])).toEqual(['00', '00', '00']);
    expect(lines([add])).toEqual(['00']);
    expect(lines([])).toEqual([]);
  });
});

describe('dayHeadingLabel', () => {
  const date = new Date(2026, 8, 3);
  const shortDate = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  it('names the day and its date', () => {
    expect(dayHeadingLabel({ day: 2, date, startsReturn: false })).toBe(`Day 2 · ${shortDate}`);
  });

  it('marks the day the drive home begins', () => {
    expect(dayHeadingLabel({ day: 2, date, startsReturn: true })).toBe(
      `Day 2 · ${shortDate} · Return`
    );
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
