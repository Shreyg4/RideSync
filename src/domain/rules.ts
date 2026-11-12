/**
 * @file rules.ts
 * @description The app's single source of truth for the values that dfine
 * what's valid or allowed.
 */
import type {
  StopCategory,
  StopType,
  TripStop,
  TripType,
  TripMemberRole,
  TripMember,
} from '@/src/types/trip';
import { addDays, daysBetween, formatShortDate, startOfDay } from '@/src/lib/dateTime';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
export const USERNAME_MIN_LENGTH = 5;
export const USERNAME_MAX_LENGTH = 20;

export const PASSWORD_MIN_LENGTH = 8;

export const TRIP_TYPES = ['one-way', 'round-trip'] as const satisfies readonly TripType[];
export const TRIP_NAME_MIN_LENGTH = 3;
export const TRIP_NAME_MAX_LENGTH = 40;

export const TRIP_STATUSES = ['planning', 'in-trip', 'completed'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const tripTypeLabel = (value: TripType) => value.charAt(0).toUpperCase() + value.slice(1);
export const tripStatusLabel = (value: TripStatus) =>
  (value.charAt(0).toUpperCase() + value.slice(1)).replace('-', ' ');

export const JOIN_CODE_LENGTH = 8;

export const formatJoinCode = (code: string) =>
  code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

export const memberRoleLabel = (value: TripMemberRole) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export const nextOwner = (members: readonly TripMember[]): TripMember | undefined =>
  members.find((member) => member.role === 'editor') ??
  members.find((member) => member.role === 'viewer');

export const STOP_NAME_MAX_LENGTH = 100;
export const STOP_NOTES_MAX_LENGTH = 500;

export const STOP_CATEGORIES = [
  'gas',
  'food',
  'coffee',
  'rest',
  'lodging',
  'attraction',
  'other',
] as const satisfies readonly StopCategory[];

export const stopCategoryLabel = (value: StopCategory) =>
  value.charAt(0).toUpperCase() + value.slice(1);

// The kinds of place the search map can look for. 'Other' isn't a kind anyone searches for
export type SearchCategory = Exclude<StopCategory, 'other'>;
export const SEARCH_CATEGORIES = STOP_CATEGORIES.filter(
  (category): category is SearchCategory => category !== 'other'
);

// Mapbox rejects a longer search
export const PLACE_QUERY_MAX_LENGTH = 256;

// A destination isn't a stop type of its own: it's a normal or overnight stop marked as the turnaround
export type NextStopType = Exclude<StopType, 'overnight'> | 'destination';

// add_trip_stop rejects normal stops until the start exists, then the end on a one-way trip or the
// destination on a round trip. Round trips finish back at the start, so they never get an end stop
export const nextStopType = (
  stops: readonly Pick<TripStop, 'stopType' | 'isTurnaround'>[],
  tripType: TripType
): NextStopType => {
  if (!stops.some((stop) => stop.stopType === 'start')) return 'start';
  if (tripType === 'one-way' && !stops.some((stop) => stop.stopType === 'end')) return 'end';
  if (tripType === 'round-trip' && !stops.some((stop) => stop.isTurnaround)) return 'destination';
  return 'stop';
};

const ADD_STOP_LABELS: Record<NextStopType, string> = {
  start: 'Set start',
  end: 'Set end',
  destination: 'Set destination',
  stop: 'Add stop',
};

export const addStopLabel = (value: NextStopType) => ADD_STOP_LABELS[value];

// Start and end have a fixed place in the trip, but the group can sleep anywhere else
export const canStayOvernight = (value: NextStopType) =>
  value === 'stop' || value === 'destination';

// Reads a route param, which can hold anything. add_trip_stop has the final say on what's allowed
export const parseNextStopType = (value: unknown): NextStopType =>
  value === 'start' || value === 'end' || value === 'destination' ? value : 'stop';

export type ItineraryRow =
  | { kind: 'stop'; stop: TripStop }
  | { kind: 'dayHeading'; day: number; date: Date; startsReturn: boolean }
  | { kind: 'returnHeading' }
  | { kind: 'add'; stopType: NextStopType; label: string; atPosition?: number }
  | { kind: 'backToStart'; stop: TripStop };

export type AddStopRow = Extract<ItineraryRow, { kind: 'add' }>;

// The group leaves an overnight stop on its departure date, or the next morning if it has none.
// A departure that isn't after the day they arrived can't be right, so it's ignored
export const departureDay = (stop: Pick<TripStop, 'departsAt'>, arrivalDay: Date) => {
  const departs = stop.departsAt ? startOfDay(stop.departsAt) : null;
  return departs && departs > arrivalDay ? departs : addDays(arrivalDay, 1);
};

// "Day 2 · Sat, Sep 12", with "· Return" when the group sleeps at the destination
export const dayHeadingLabel = ({
  day,
  date,
  startsReturn,
}: Pick<Extract<ItineraryRow, { kind: 'dayHeading' }>, 'day' | 'date' | 'startsReturn'>) =>
  [`Day ${day}`, formatShortDate(date), startsReturn ? 'Return' : null].filter(Boolean).join(' · ');

// The itinerary as the planner and trip details list it. Days aren't stored: each overnight stop
// ends one, and days are numbered by date, so a two-night stay skips a number. Until the trip has
// its start and its end or destination, the one button sits at the bottom. After that, new stops
// go just before the end or destination, which is where add_trip_stop puts a stop given no
// position. A round trip's drive home has its own heading and button, then the list finishes back
// at the start
export const itineraryRows = (
  stops: readonly TripStop[],
  tripType: TripType,
  startsAt: Date,
  canAdd: boolean
): ItineraryRow[] => {
  const next = nextStopType(stops, tripType);
  const hasBothEnds = next === 'stop';
  const rows: ItineraryRow[] = [];
  const firstDay = startOfDay(startsAt);
  let currentDay = firstDay;

  if (stops.length > 0) {
    rows.push({ kind: 'dayHeading', day: 1, date: firstDay, startsReturn: false });
  }

  for (const stop of stops) {
    if (canAdd && hasBothEnds && (stop.isTurnaround || stop.stopType === 'end')) {
      rows.push({ kind: 'add', stopType: 'stop', label: addStopLabel('stop') });
    }
    rows.push({ kind: 'stop', stop });

    if (stop.stopType === 'overnight') {
      currentDay = departureDay(stop, currentDay);
      rows.push({
        kind: 'dayHeading',
        day: daysBetween(firstDay, currentDay) + 1,
        date: currentDay,
        startsReturn: stop.isTurnaround,
      });
    } else if (stop.isTurnaround) {
      rows.push({ kind: 'returnHeading' });
    }
  }

  if (canAdd && !hasBothEnds) rows.push({ kind: 'add', stopType: next, label: addStopLabel(next) });

  if (tripType === 'round-trip') {
    // A position past the last stop puts it at the end of the drive home
    if (canAdd && hasBothEnds) {
      rows.push({
        kind: 'add',
        stopType: 'stop',
        label: 'Add return stop',
        atPosition: stops.length,
      });
    }
    const start = stops.find((stop) => stop.stopType === 'start');
    if (start) rows.push({ kind: 'backToStart', stop: start });
  }

  return rows;
};

// Also a route param. Without a usable position, add_trip_stop puts the stop at the end of the list
export const parseStopPosition = (value: unknown): number | undefined => {
  const position = typeof value === 'string' && value !== '' ? Number(value) : NaN;
  return Number.isInteger(position) && position >= 0 ? position : undefined;
};

// A route param naming a saved stop. Ids start at 1
export const parseStopId = (value: unknown): number | undefined => {
  const id = parseStopPosition(value);
  return id !== undefined && id > 0 ? id : undefined;
};

// The stops a new stop can be added after. Nothing comes after the end of a one-way trip
export const fromStopOptions = (stops: readonly TripStop[]) =>
  stops.filter((stop) => stop.stopType !== 'end');

// The stop a new one follows when the user doesn't pick another: the one before the position it
// was opened with, or else the one before the end or destination, which is where add_trip_stop
// puts a stop given no position
export const defaultFromStop = (
  stops: readonly TripStop[],
  atPosition?: number
): TripStop | undefined => {
  const options = fromStopOptions(stops);
  const insertAt =
    atPosition ??
    stops.find((stop) => stop.isTurnaround || stop.stopType === 'end')?.position ??
    stops.length;
  return options.findLast((stop) => stop.position < insertAt) ?? options[0];
};

// The trip's fixed points: where it starts, turns around and ends
export const isKeyStop = ({
  stopType,
  isTurnaround,
}: Pick<TripStop, 'stopType' | 'isTurnaround'>) =>
  isTurnaround || stopType === 'start' || stopType === 'end';

// What a saved stop is in the trip, in the terms search and the preview use. Overnight is only a
// setting on a normal stop or the destination, so it isn't one of these
export const stopRole = ({
  stopType,
  isTurnaround,
}: Pick<TripStop, 'stopType' | 'isTurnaround'>): NextStopType => {
  if (isTurnaround) return 'destination';
  return stopType === 'overnight' ? 'stop' : stopType;
};

// The start, end and destination split the trip into its way there and way home, so they can be
// moved to another place but not taken off. remove_trip_stop enforces this for start and end
export const canRemoveStop = (stop: Pick<TripStop, 'stopType' | 'isTurnaround'>) =>
  !isKeyStop(stop);

// The day the group reaches a stop: the date of the last day heading above it in the itinerary
export const stopArrivalDay = (rows: readonly ItineraryRow[], stopId: number): Date | undefined => {
  let day: Date | undefined;
  for (const row of rows) {
    if (row.kind === 'dayHeading') day = row.date;
    if (row.kind === 'stop' && row.stop.id === stopId) return day;
  }
  return undefined;
};

// When the group leaves an overnight stop if nobody picks a time
export const DEFAULT_DEPARTURE_HOUR = 9;

// A departure has to be on a later day than the arrival, or the itinerary ignores it
export const earliestDepartureDay = (arrivalDay: Date) => addDays(startOfDay(arrivalDay), 1);

export const defaultDeparture = (arrivalDay: Date) => {
  const next = earliestDepartureDay(arrivalDay);
  next.setHours(DEFAULT_DEPARTURE_HOUR);
  return next;
};

// A normal stop is described by what it is. Start, end and overnight stops by their place in the trip
export const stopLabel = ({
  stopType,
  stopCategory,
  isTurnaround,
}: Pick<TripStop, 'stopType' | 'stopCategory' | 'isTurnaround'>) => {
  if (isTurnaround) return stopType === 'overnight' ? 'Destination (overnight)' : 'Destination';
  const value = stopType === 'stop' ? stopCategory : stopType;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

// Mapbox gives a place several category ids, so the first group that matches wins.
// A Starbucks is tagged both coffee and food, and a hotel or rest area may also serve food
const STOP_CATEGORY_IDS: readonly (readonly [StopCategory, readonly string[]])[] = [
  ['gas', ['gas_station', 'charging_station']],
  ['lodging', ['lodging', 'hotel', 'motel', 'hostel', 'bed_and_breakfast', 'resort', 'campground']],
  ['rest', ['rest_area']],
  ['coffee', ['coffee', 'coffee_shop', 'cafe']],
  ['food', ['food', 'food_and_drink', 'restaurant', 'fast_food']],
  [
    'attraction',
    [
      'tourist_attraction',
      'historic_site',
      'monument',
      'museum',
      'art_gallery',
      'park',
      'national_park',
      'state_park',
      'beach',
      'viewpoint',
      'zoo',
      'aquarium',
      'theme_park',
      'water_park',
    ],
  ],
];

export const toStopCategory = (mapboxIds: readonly string[] = []): StopCategory =>
  STOP_CATEGORY_IDS.find(([, ids]) => ids.some((id) => mapboxIds.includes(id)))?.[0] ?? 'other';

export const ITINERARY_PREVIEW_MAX_PLACES = 5;

const isPlaceRow = (row: ItineraryRow) => row.kind === 'stop' || row.kind === 'backToStart';

// A short itinerary for trip details; the planner has the whole thing. A list that's cut keeps one
// place fewer than the max, so what's hidden is always at least one stop plus the finish, never
// just the finish. Headings left at the bottom with no stop under them go too
export const previewRows = (
  rows: readonly ItineraryRow[],
  maxPlaces = ITINERARY_PREVIEW_MAX_PLACES
): { rows: ItineraryRow[]; hiddenStops: number } => {
  if (rows.filter(isPlaceRow).length <= maxPlaces) return { rows: [...rows], hiddenStops: 0 };

  let places = 0;
  const end = rows.findIndex((row) => isPlaceRow(row) && ++places === maxPlaces);
  const shown = rows.slice(0, end);
  while (shown.length > 0 && !isPlaceRow(shown[shown.length - 1])) shown.pop();

  return {
    rows: shown,
    hiddenStops: rows.slice(end).filter((row) => row.kind === 'stop').length,
  };
};

export type TimelineSegment = { lineAbove: boolean; lineBelow: boolean };

// Where the line beside the itinerary runs. Each day has its own line, from its first place down to
// its last, through the headings and buttons between them. It stops at a day heading, so a new day
// starts a new line
export const timeline = (rows: readonly ItineraryRow[]): TimelineSegment[] => {
  const segments: TimelineSegment[] = [];
  let dayStart = 0;

  rows.forEach((row, index) => {
    const isLastRow = index === rows.length - 1;
    if (row.kind !== 'dayHeading' && !isLastRow) return;

    const dayEnd = row.kind === 'dayHeading' ? index : index + 1;
    const day = rows.slice(dayStart, dayEnd);
    const placeIndexes = day.flatMap((dayRow, i) => (isPlaceRow(dayRow) ? [i] : []));
    const first = placeIndexes[0] ?? -1;
    const last = placeIndexes[placeIndexes.length - 1] ?? -1;

    day.forEach((dayRow, i) => {
      const between = i > first && i < last;
      segments.push(
        isPlaceRow(dayRow)
          ? { lineAbove: i > first, lineBelow: i < last }
          : { lineAbove: between, lineBelow: between }
      );
    });
    if (row.kind === 'dayHeading') segments.push({ lineAbove: false, lineBelow: false });
    dayStart = index + 1;
  });

  return segments;
};
