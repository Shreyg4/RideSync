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

// True for the first stop after the destination, where the drive home begins
export const startsReturnLeg = (stops: readonly Pick<TripStop, 'isTurnaround'>[], index: number) =>
  index > 0 && stops[index - 1].isTurnaround;

// Also a route param. Without a usable position, add_trip_stop puts the stop at the end of the list
export const parseStopPosition = (value: unknown): number | undefined => {
  const position = typeof value === 'string' && value !== '' ? Number(value) : NaN;
  return Number.isInteger(position) && position >= 0 ? position : undefined;
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
