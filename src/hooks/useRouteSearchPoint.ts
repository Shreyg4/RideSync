/**
 * @file useRouteSearchPoint.ts
 * @description Where along the route a map search looks: which way of the trip, how far into its
 * drive, and how wide an area around that point
 */
import { useCallback, useMemo, useState } from 'react';
import { snapToStep } from '@/src/components/LabeledSlider';
import { pointAtTime, sectionFor } from '@/src/domain/route';
import type { RouteDirection, RoutePoint, RouteSection, RouteSections } from '@/src/domain/route';

// The time slider moves in five-minute steps, which is finer than a search area can tell apart
export const TIME_STEP_SECONDS = 5 * 60;
export const SEARCH_RADIUS_MILES = { min: 2, max: 25, step: 1, initial: 10 } as const;

export type RouteSearchPoint = {
  direction: RouteDirection;
  setDirection: (direction: RouteDirection) => void; // also moves the time back to the middle
  hasReturn: boolean; // whether there's a drive home, so a choice of which way to search
  section: RouteSection | null; // null until the route is in
  seconds: number; // driving time into the section, on a slider step
  setSeconds: (seconds: number) => void;
  radiusMiles: number;
  setRadiusMiles: (miles: number) => void;
  point: RoutePoint | null;
};

// sections must keep the same identity until the route changes, so the point isn't worked out again
// on every render. initialDirection is only read on the first render, and a trip with no drive home
// searches the way there whatever it says
export const useRouteSearchPoint = (
  sections: RouteSections | null,
  initialDirection: RouteDirection = 'outbound'
): RouteSearchPoint => {
  const [direction, setDirectionState] = useState<RouteDirection>(initialDirection);
  // Null means the middle of the section, which also stays right if the route changes length
  const [chosenSeconds, setChosenSeconds] = useState<number | null>(null);
  const [radiusMiles, setRadiusMiles] = useState<number>(SEARCH_RADIUS_MILES.initial);

  const section = sections ? sectionFor(sections, direction) : null;
  const seconds = section
    ? snapToStep(chosenSeconds ?? section.duration / 2, 0, section.duration, TIME_STEP_SECONDS)
    : 0;
  const point = useMemo(() => (section ? pointAtTime(section, seconds) : null), [section, seconds]);

  const setDirection = useCallback((next: RouteDirection) => {
    setDirectionState(next);
    setChosenSeconds(null);
  }, []);

  return {
    direction: section?.direction ?? 'outbound',
    setDirection,
    hasReturn: !!sections?.return,
    section,
    seconds,
    setSeconds: setChosenSeconds,
    radiusMiles,
    setRadiusMiles,
    point,
  };
};
