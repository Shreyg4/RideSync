/**
 * @file RouteSearchPanel.tsx
 * @description The controls at the bottom of search for looking along the route: which way of a
 * round trip, how far into its drive, and how wide an area to look in
 */
import type { LayoutChangeEvent } from 'react-native';
import type { ReactNode } from 'react';
import BottomSheet from '@/src/components/BottomSheet';
import LabeledSlider from '@/src/components/LabeledSlider';
import RouteDirectionChips from '@/src/components/RouteDirectionChips';
import { formatDuration } from '@/src/domain/route';
import type { RouteDirection } from '@/src/domain/route';
import type { RouteSearchPoint } from '@/src/hooks/useRouteSearchPoint';
import { SEARCH_RADIUS_MILES, TIME_STEP_SECONDS } from '@/src/hooks/useRouteSearchPoint';

type RouteSearchPanelProps = {
  search: RouteSearchPoint;
  // Told when a slider is let go or the way changes, which is when a search should run again
  onSettled: () => void;
  onDragging: () => void; // told while a slider is moving, so nothing searches mid-drag
  onLayout?: (event: LayoutChangeEvent) => void;
  children?: ReactNode; // what to look for there, under the sliders
  // The phone's own space along the bottom edge, like the home indicator. The panel runs under it
  // and pads its controls above it, so a swipe meant for the phone never lands on a slider
  bottomInset?: number;
};

const TIME_LABELS: Record<RouteDirection, string> = {
  full: 'Time into the trip',
  outbound: 'Time into the drive',
  return: 'Time into the drive home',
};

// "0 min" at the start, then "45 min", "1 h 45 min"
export const formatTimeIntoDrive = (seconds: number) =>
  seconds === 0 ? '0 min' : formatDuration(seconds);

const RouteSearchPanel = ({
  search,
  onSettled,
  onDragging,
  onLayout,
  children,
  bottomInset = 0,
}: RouteSearchPanelProps) => {
  const { section } = search;
  if (!section) return null;

  return (
    <BottomSheet bottomInset={bottomInset} onLayout={onLayout} testID="route-search-panel">
      {search.hasReturn ? (
        <RouteDirectionChips
          value={search.direction}
          onChange={(direction) => {
            search.setDirection(direction);
            onSettled();
          }}
        />
      ) : null}

      <LabeledSlider
        label={TIME_LABELS[search.direction]}
        value={search.seconds}
        minimumValue={0}
        maximumValue={section.duration}
        step={TIME_STEP_SECONDS}
        // Stops all at one spot make a drive of no time, with nowhere along it to move to
        disabled={section.duration === 0}
        formatValue={formatTimeIntoDrive}
        onValueChange={(seconds) => {
          onDragging();
          search.setSeconds(seconds);
        }}
        onSlidingComplete={(seconds) => {
          search.setSeconds(seconds);
          onSettled();
        }}
        testID="route-time-slider"
      />
      <LabeledSlider
        label="Search radius"
        value={search.radiusMiles}
        minimumValue={SEARCH_RADIUS_MILES.min}
        maximumValue={SEARCH_RADIUS_MILES.max}
        step={SEARCH_RADIUS_MILES.step}
        formatValue={(miles) => `${miles} mi`}
        onValueChange={(miles) => {
          onDragging();
          search.setRadiusMiles(miles);
        }}
        onSlidingComplete={(miles) => {
          search.setRadiusMiles(miles);
          onSettled();
        }}
        testID="route-radius-slider"
      />
      {children}
    </BottomSheet>
  );
};

export default RouteSearchPanel;
