/**
 * @file route.ts
 * @description The driving route worked out from a trip's stops: the points it drives through, how
 * they're sent to Mapbox, and when the group reaches each stop
 */
import { DEFAULT_DEPARTURE_HOUR, departureDay } from '@/src/domain/rules';
import { formatTime, formatWeekday, startOfDay } from '@/src/lib/dateTime';
import { cumulativeDistances, METERS_PER_MILE, positionAtDistance, sliceLine } from '@/src/lib/geo';
import type { Position } from '@/src/lib/mapCamera';
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

// The way there, a round trip's way back, or all of it at once
export type RouteDirection = 'full' | 'outbound' | 'return';

// A stretch of the trip: start to destination or end, a round trip's drive from its destination
// back to the start, or the whole drive
export type RouteSection = {
  direction: RouteDirection;
  firstLeg: number; // the route's index for this section's first leg
  legs: RouteLeg[];
  duration: number; // seconds of driving across the section
  line: Position[]; // the part of the route line it covers
  distances: number[]; // how far along line each of its points is, in meters
  legEnds: number[]; // how far along line each leg ends, in meters
};

export type RouteSections = {
  full: RouteSection; // the whole drive; a one-way trip's is the same as its way there
  outbound: RouteSection;
  return: RouteSection | null; // round trips only
};

// The section to show or search for a direction. A one-way trip has no way back, so it gets its
// way there
export const sectionFor = (sections: RouteSections, direction: RouteDirection) =>
  direction === 'return' ? (sections.return ?? sections.outbound) : sections[direction];

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

// Splits the route line at the destination. The line doesn't say where each stop is on it, so each
// stop is placed by its share of Mapbox's leg distances. That avoids matching stops to the nearest
// point on the line, which picks the wrong pass on a road driven both ways. Null when the legs and
// line don't belong to these stops, like while a new route is on its way
export const routeSections = (
  stops: readonly TripStop[],
  tripType: TripType,
  legs: readonly RouteLeg[],
  line: readonly Position[]
): RouteSections | null => {
  const pointCount = routePoints(stops, tripType).length;
  if (pointCount < 2 || legs.length !== pointCount - 1 || line.length < 2) return null;

  const lineDistances = cumulativeDistances(line);
  const lineLength = lineDistances[lineDistances.length - 1];
  const legDistance = sum(legs.map((leg) => leg.distance));

  // How far along the line each route point is. Without distances, legs share the line evenly
  const pointAt = [0];
  legs.reduce((acc, leg, index) => {
    const next = acc + leg.distance;
    pointAt.push(
      legDistance > 0 ? (next / legDistance) * lineLength : ((index + 1) / legs.length) * lineLength
    );
    return next;
  }, 0);

  const section = (direction: RouteDirection, from: number, to: number): RouteSection => {
    const start = pointAt[from];
    const sectionLine = sliceLine(line, lineDistances, start, pointAt[to]);
    const sectionLegs = legs.slice(from, to);
    return {
      direction,
      firstLeg: from,
      legs: sectionLegs,
      duration: sum(sectionLegs.map((leg) => leg.duration)),
      line: sectionLine,
      distances: cumulativeDistances(sectionLine),
      legEnds: pointAt.slice(from + 1, to + 1).map((at) => at - start),
    };
  };

  // A round trip's destination is a stop's index, which is also its route point's index
  const turnaround = tripType === 'round-trip' ? stops.findIndex((stop) => stop.isTurnaround) : -1;
  const split = turnaround > 0 ? turnaround : legs.length;
  const outbound = section('outbound', 0, split);
  const hasReturn = split < legs.length;
  return {
    full: hasReturn ? section('full', 0, legs.length) : { ...outbound, direction: 'full' },
    outbound,
    return: hasReturn ? section('return', split, legs.length) : null,
  };
};

export type RoutePoint = Coordinates & {
  seconds: number; // the time asked for, kept within the section
  legIndex: number; // the route's index for the leg the point is on
};

// Where the group is after the given seconds of driving into the section. Within a leg it assumes a
// steady speed, so the point can be a few miles off on a leg mixing city streets and highway
// Which of the section's legs a time into its drive falls on, and when that leg starts. A time
// exactly at a stop counts as the end of the leg reaching it
const legAtTime = (section: RouteSection, seconds: number) => {
  const time = Math.min(Math.max(seconds, 0), section.duration);
  let legStartsAt = 0;
  let index = 0;
  for (; index < section.legs.length - 1; index += 1) {
    const legEndsAt = legStartsAt + section.legs[index].duration;
    if (time <= legEndsAt) break;
    legStartsAt = legEndsAt;
  }
  return { index, time, legStartsAt };
};

export const pointAtTime = (section: RouteSection, seconds: number): RoutePoint => {
  const { index, time, legStartsAt } = legAtTime(section, seconds);
  const legStart = index === 0 ? 0 : section.legEnds[index - 1];
  const leg = section.legs[index];
  const fraction = leg.duration > 0 ? Math.min((time - legStartsAt) / leg.duration, 1) : 0;
  const distance = legStart + (section.legEnds[index] - legStart) * fraction;
  const [lng, lat] = positionAtDistance(section.line, section.distances, distance);
  return { lat, lng, seconds: time, legIndex: section.firstLeg + index };
};

// The stops a section drives through, by id: its first leg's stop to its last leg's. A round trip's
// drive home ends back at the start, which is the first stop
export const sectionStopIds = (
  stops: readonly Pick<TripStop, 'id'>[],
  section: Pick<RouteSection, 'firstLeg' | 'legs'>
): Set<number> => {
  const ids = new Set<number>();
  for (let index = section.firstLeg; index <= section.firstLeg + section.legs.length; index += 1) {
    const stop = stops[index] ?? stops[0];
    if (stop) ids.add(stop.id);
  }
  return ids;
};
