/**
 * @file TripProgressControls.tsx
 * @description The buttons that run a trip: Start while it's being planned, then Pause or Resume
 * and End once it's underway. Only the owner and editors get the buttons; everyone sees the status
 */
import { StyleSheet, Text } from 'react-native';
import LargeButton from '@/src/components/LargeButton';
import { colors, fontSize, fontWeight, spacing } from '@/src/constants/theme';
import type { TripStatus } from '@/src/domain/rules';

type TripProgressControlsProps = {
  status: TripStatus;
  canControl: boolean; // the owner or an editor
  canStart: boolean; // the trip has its start and its end or destination
  busy: boolean; // a status change is saving
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
};

const STATUS_TEXT: Partial<Record<TripStatus, string>> = {
  'in-trip': 'Trip in progress',
  paused: 'Trip paused',
};

const TripProgressControls = ({
  status,
  canControl,
  canStart,
  busy,
  onStart,
  onPause,
  onResume,
  onEnd,
}: TripProgressControlsProps) => {
  const statusText = STATUS_TEXT[status];
  const underway = status === 'in-trip' || status === 'paused';

  return (
    <>
      {statusText ? (
        <Text style={styles.status} testID="trip-status">
          {statusText}
        </Text>
      ) : null}

      {status === 'planning' ? (
        <>
          {canControl && !canStart ? (
            <Text style={styles.hint} testID="trip-start-hint">
              Set a start and destination in the planner to start the trip
            </Text>
          ) : null}
          {!canControl ? (
            <Text style={styles.hint} testID="trip-start-hint">
              The owner or an editor can start the trip
            </Text>
          ) : null}
          <LargeButton
            label="Start Trip"
            disabled={!canControl || !canStart || busy}
            onPress={onStart}
            testID="trip-start-button"
          />
        </>
      ) : null}

      {underway && canControl ? (
        <>
          {status === 'in-trip' ? (
            <LargeButton
              label="Pause Trip"
              disabled={busy}
              onPress={onPause}
              testID="trip-pause-button"
            />
          ) : (
            <LargeButton
              label="Resume Trip"
              disabled={busy}
              onPress={onResume}
              testID="trip-resume-button"
            />
          )}
          <LargeButton
            label="End Trip"
            variant="danger"
            disabled={busy}
            onPress={onEnd}
            testID="trip-end-button"
          />
        </>
      ) : null}
    </>
  );
};

export default TripProgressControls;

const styles = StyleSheet.create({
  status: {
    color: colors.tint,
    fontSize: fontSize.sheetTitle,
    fontWeight: fontWeight.heavy,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  hint: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
    textAlign: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
});
