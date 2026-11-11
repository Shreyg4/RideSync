/**
 * @file StopsMap.tsx
 * @description A trip's stops on a map, numbered in the order the group reaches them. The map keeps
 * every stop in view, and moves when stops are added, moved or removed
 */
import { MarkerView } from '@rnmapbox/maps';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import TripMap from '@/src/components/TripMap';
import { haptics } from '@/src/constants/haptics';
import { colors, fontSize, fontWeight, radii } from '@/src/constants/theme';
import { isKeyStop } from '@/src/domain/rules';
import type { TripStop } from '@/src/types/trip';

const PIN_SIZE = 28;

type StopsMapProps = {
  stops: readonly TripStop[]; // in trip order, which sets each pin's number
  onOpenStop?: (stop: TripStop) => void; // pins can't be tapped without it
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type StopMarkersProps = {
  stops: readonly TripStop[]; // in trip order, which sets each pin's number
  onOpenStop?: (stop: TripStop) => void; // pins can't be tapped without it
};

// The numbered pins on their own, for a map that sets its own camera, like search's
export const StopMarkers = ({ stops, onOpenStop }: StopMarkersProps) =>
  stops.map((stop, index) => {
    // The start, destination and end are tinted, as they are in the itinerary list
    const keyStop = isKeyStop(stop);
    return (
      <MarkerView
        key={stop.id}
        // Mapbox reads coordinates longitude first
        coordinate={[stop.lng, stop.lat]}
        // Two stops close together would otherwise hide one of the pins
        allowOverlap
        testID={`map-pin-${stop.id}`}
      >
        <Pressable
          disabled={!onOpenStop}
          onPress={() => {
            haptics.action();
            onOpenStop?.(stop);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Stop ${index + 1}, ${stop.name}`}
          style={[styles.pin, keyStop && styles.keyPin]}
        >
          <Text style={[styles.number, keyStop && styles.keyNumber]}>{index + 1}</Text>
        </Pressable>
      </MarkerView>
    );
  });

const StopsMap = ({ stops, onOpenStop, style, testID }: StopsMapProps) => (
  <TripMap fitTo={stops} style={style} testID={testID}>
    <StopMarkers stops={stops} onOpenStop={onOpenStop} />
  </TripMap>
);

export default StopsMap;

const styles = StyleSheet.create({
  pin: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.tint,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPin: {
    backgroundColor: colors.tint,
    borderColor: colors.textOnTint,
  },
  number: {
    color: colors.text,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
  },
  keyNumber: {
    color: colors.textOnTint,
  },
});
