/**
 * @file route.ts
 * @description The driving route worked out from a trip's stops: the points it drives through, how
 * they're sent to Mapbox, and when the group reaches each stop
 */
import { DEFAULT_DEPARTURE_HOUR, departureDay } from '@/src/domain/rules';
import { formatTime, formatWeekday, startOfDay } from '@/src/lib/dateTime';
import type { Coordinates, TripStop, TripType } from '@/src/types/trip';

// Mapbox Directions takes at most 25 points per request on the driving profile
export const MAX_ROUTE_POINTS = 25;

// One drive between two points, in seconds and meters
export type RouteLeg = { duration: number; distance: number };

export type TripRoute = {
  key: string; // the points it was made for, from routeKey
  legs: RouteLeg[]; // one per drive, in trip order
  geometry: string[]; // the line as polyline6, one part per Directions request
};

// The places the route drives through, in order. A round trip finishes back at its start. Fewer
// than two places is no route at all
export const routePoints = (
  stops: readonly Pick<TripStop, 'lat' | 'lng' | 'stopType'>[],
  tripType: TripType
): Coordinates[] => {
  const points = stops.map(({ lat, lng }) => ({ lat, lng }));
  const start = stops.find((stop) => stop.stopType === 'start');
  if (tripType === 'round-trip' && start && stops.length > 1) {
    points.push({ lat: start.lat, lng: start.lng });
  }
  return points.length >= 2 ? points : [];
};

// Mapbox reads longitude first. Six decimals is about 10 cm, so the same stops always give the
// same text
export const coordinatePair = ({ lat, lng }: Coordinates) => `${lng.toFixed(6)},${lat.toFixed(6)}`;

// Says which points a saved route was made for. It's also the path Directions is asked for
export const routeKey = (points: readonly Coordinates[]) => points.map(coordinatePair).join(';');

// Splits a route too long for one request. Each part starts where the one before ended, so their
// legs join up into one trip
export const routeChunks = <T>(points: readonly T[], max = MAX_ROUTE_POINTS): T[][] => {
  const chunks: T[][] = [];
  for (let from = 0; from < points.length - 1; from += max - 1) {
    chunks.push(points.slice(from, from + max));
  }
  return chunks;
};

export type StopTiming = {
  arrivesAt: Date | null; // null at the start, which the group only leaves
  leavesAt: Date | null; // null at a one-way trip's end
  drive: RouteLeg | null; // the drive from the place before
  day: Date; // the itinerary day the stop is listed under
};

export type TripTimings = {
  stops: Map<number, StopTiming>;
  backToStart: (StopTiming & { arrivesAt: Date; drive: RouteLeg }) | null; // round trips only
  totalDuration: number; // seconds of driving, not counting stops and nights
  totalDistance: number; // meters
};

// The group leaves an overnight stop at its departure time, or 9 the next morning without one. It
// can't leave before it gets there, which a very long drive could otherwise make it do
const overnightDeparture = (stop: Pick<TripStop, 'departsAt'>, leaveDay: Date, arrivesAt: Date) => {
  let leaves: Date;
  if (stop.departsAt && startOfDay(stop.departsAt).getTime() === leaveDay.getTime()) {
    leaves = stop.departsAt;
  } else {
    leaves = new Date(leaveDay);
    leaves.setHours(DEFAULT_DEPARTURE_HOUR);
  }
  return leaves > arrivesAt ? leaves : arrivesAt;
};

const addSeconds = (date: Date, seconds: number) => new Date(date.getTime() + seconds * 1000);

// When the group reaches and leaves each stop, starting from the trip's start time. Days follow
// the same rule as the itinerary's day headings, so a stop's times match the day it's listed under.
// Null when the legs don't belong to these stops, like while a new route is on its way
export const tripTimings = (
  stops: readonly TripStop[],
  tripType: TripType,
  startsAt: Date,
  legs: readonly RouteLeg[]
): TripTimings | null => {
  const legCount = routePoints(stops, tripType).length - 1;
  if (legCount < 1 || legs.length !== legCount) return null;

  const timings = new Map<number, StopTiming>();
  let day = startOfDay(startsAt);
  let leaves = startsAt;

  stops.forEach((stop, index) => {
    if (index === 0) {
      timings.set(stop.id, { arrivesAt: null, leavesAt: startsAt, drive: null, day });
      return;
    }

    const drive = legs[index - 1];
    const arrivesAt = addSeconds(leaves, drive.duration);
    const arrivalDay = day;
    if (stop.stopType === 'overnight') {
      day = departureDay(stop, day);
      leaves = overnightDeparture(stop, day, arrivesAt);
    } else {
      leaves = arrivesAt;
    }

    const isFinish = tripType === 'one-way' && index === stops.length - 1;
    timings.set(stop.id, { arrivesAt, leavesAt: isFinish ? null : leaves, drive, day: arrivalDay });
  });

  const homeDrive = tripType === 'round-trip' ? legs[legs.length - 1] : null;
  return {
    stops: timings,
    backToStart: homeDrive
      ? { arrivesAt: addSeconds(leaves, homeDrive.duration), leavesAt: null, drive: homeDrive, day }
      : null,
    totalDuration: legs.reduce((sum, leg) => sum + leg.duration, 0),
    totalDistance: legs.reduce((sum, leg) => sum + leg.distance, 0),
  };
};

// "45 min", "2 h", "2 h 5 min"
export const formatDuration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

const METERS_PER_MILE = 1609.344;

// "4.2 mi" for short drives, "137 mi" for longer ones
export const formatDistance = (meters: number) => {
  const miles = meters / METERS_PER_MILE;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
};

// The time, with the weekday when it isn't on the day the stop is listed under, like after a drive
// past midnight or when leaving an overnight stop
const timeOn = (date: Date, day: Date) =>
  startOfDay(date).getTime() === day.getTime()
    ? formatTime(date)
    : `${formatWeekday(date)} ${formatTime(date)}`;

// One line under a stop in the itinerary: "Leave 9:00 AM", "Arrive 11:30 AM · 2 h 31 min drive",
// and for an overnight stop, when the group leaves again
export const stopTimingLabel = (
  stop: Pick<TripStop, 'stopType'>,
  { arrivesAt, leavesAt, drive, day }: StopTiming
) => {
  if (!arrivesAt || !drive) return leavesAt ? `Leave ${timeOn(leavesAt, day)}` : null;
  return [
    `Arrive ${timeOn(arrivesAt, day)}`,
    `${formatDuration(drive.duration)} drive`,
    stop.stopType === 'overnight' && leavesAt ? `Leave ${timeOn(leavesAt, day)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
};

// "8 h 50 min driving · 512 mi"
export const routeTotalsLabel = ({ totalDuration, totalDistance }: TripTimings) =>
  `${formatDuration(totalDuration)} driving · ${formatDistance(totalDistance)}`;
