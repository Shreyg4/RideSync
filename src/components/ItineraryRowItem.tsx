import { MapPin, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LargeButton from '@/src/components/LargeButton';
import StopListItem from '@/src/components/StopListItem';
import { colors, fontSize, fontWeight, spacing } from '@/src/constants/theme';
import { dayHeadingLabel, isKeyStop } from '@/src/domain/rules';
import type { AddStopRow, ItineraryRow, TimelineSegment } from '@/src/domain/rules';
import type { TripStop } from '@/src/types/trip';

type ItineraryRowItemProps = {
  row: ItineraryRow;
  segment?: TimelineSegment; // where the line beside the list runs, from timeline()
  onAdd?: (row: AddStopRow) => void;
  onOpenStop?: (stop: TripStop) => void; // leaves the stop cards untappable when not given
  highlightKeyStops?: boolean; // tints the start, destination, end and the return to the start
  compact?: boolean; // less space between rows, for short lists
};

export const itineraryRowKey = (row: ItineraryRow) => {
  switch (row.kind) {
    case 'stop':
      return `stop-${row.stop.id}`;
    case 'dayHeading':
      return `day-${row.day}`;
    case 'add':
      return `add-${row.atPosition ?? 'next'}`;
    default:
      return row.kind;
  }
};

const NO_LINE: TimelineSegment = { lineAbove: false, lineBelow: false };

// The trip's fixed points get a pin, every other stop a dot, and other rows only the line
// The icon's svg doesn't keep a testID, so a view around it holds one
const pin = (testID: string) => (
  <View testID={testID}>
    <MapPin {...pinProps} />
  </View>
);

const marker = (row: ItineraryRow) => {
  if (row.kind === 'backToStart') return pin('pin-back-to-start');
  if (row.kind !== 'stop') return null;
  return isKeyStop(row.stop) ? (
    pin(`pin-${row.stop.id}`)
  ) : (
    <View style={styles.dot} testID={`dot-${row.stop.id}`} />
  );
};

const rowContent = (
  row: ItineraryRow,
  { onAdd, onOpenStop, highlightKeyStops = false, compact = false }: ItineraryRowItemProps
): ReactNode => {
  const headingStyle = [styles.heading, compact && styles.compactHeading];

  switch (row.kind) {
    case 'stop':
      return (
        <StopListItem
          stop={row.stop}
          highlighted={highlightKeyStops && isKeyStop(row.stop)}
          compact={compact}
          onPress={onOpenStop && (() => onOpenStop(row.stop))}
          testID={`stop-${row.stop.id}`}
        />
      );
    case 'dayHeading':
      return (
        <Text
          style={[headingStyle, styles.dayHeading]}
          accessibilityRole="header"
          testID={`day-${row.day}`}
        >
          {dayHeadingLabel(row)}
        </Text>
      );
    case 'returnHeading':
      return (
        <Text style={headingStyle} accessibilityRole="header">
          Return
        </Text>
      );
    case 'add':
      return (
        <LargeButton icon={Plus} label={row.label} variant="dashed" onPress={() => onAdd?.(row)} />
      );
    case 'backToStart':
      return (
        <StopListItem
          stop={row.stop}
          label="Back to start"
          highlighted={highlightKeyStops}
          compact={compact}
          onPress={onOpenStop && (() => onOpenStop(row.stop))}
          testID="back-to-start"
        />
      );
  }
};

const ItineraryRowItem = (props: ItineraryRowItemProps) => {
  const { row, segment = NO_LINE } = props;

  return (
    <View style={styles.row}>
      {/* Only decoration: each row already says what it is */}
      <View
        style={styles.rail}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.line, !segment.lineAbove && styles.noLine]} />
        {marker(row)}
        <View style={[styles.line, !segment.lineBelow && styles.noLine]} />
      </View>
      <View style={styles.content}>{rowContent(row, props)}</View>
    </View>
  );
};

export default ItineraryRowItem;

const RAIL_WIDTH = 24;

const pinProps = {
  color: colors.tint,
  size: 18,
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
  // Each half stretches to the row's edge, so the halves of neighboring rows meet
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.tint,
  },
  noLine: {
    backgroundColor: 'transparent',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.tint,
  },
  content: {
    flex: 1,
  },
  heading: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    marginHorizontal: spacing.xs,
    marginTop: spacing.sm,
  },
  // Days split up the trip, so they stand out more than the Return heading
  dayHeading: {
    fontSize: fontSize.section,
    fontWeight: fontWeight.bold,
  },
  compactHeading: {
    marginHorizontal: 0,
    marginTop: spacing.xs,
    marginBottom: spacing.xxs / 2,
  },
});
