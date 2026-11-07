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

type NextStopType = Exclude<StopType, 'overnight'>;

// add_trip_stop rejects normal stops until the start exists, and the end too on a one-way trip.
// Round trips finish back at the start, so they never get an end stop
export const nextStopType = (
  stops: readonly Pick<TripStop, 'stopType'>[],
  tripType: TripType
): NextStopType => {
  if (!stops.some((stop) => stop.stopType === 'start')) return 'start';
  if (tripType === 'one-way' && !stops.some((stop) => stop.stopType === 'end')) return 'end';
  return 'stop';
};

const ADD_STOP_LABELS: Record<NextStopType, string> = {
  start: 'Set start',
  end: 'Set end',
  stop: 'Add stop',
};

export const addStopLabel = (value: NextStopType) => ADD_STOP_LABELS[value];

// A normal stop is described by what it is. Start, end and overnight stops by their place in the trip
export const stopLabel = ({
  stopType,
  stopCategory,
}: Pick<TripStop, 'stopType' | 'stopCategory'>) => {
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
