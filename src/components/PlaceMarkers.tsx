/**
 * @file PlaceMarkers.tsx
 * @description Pins for places a category search found. They look different from the trip's numbered
 * stops, and the one the user tapped stands out
 */
import { MarkerView } from '@rnmapbox/maps';
import { Pressable, StyleSheet } from 'react-native';
import { haptics } from '@/src/constants/haptics';
import { colors, radii } from '@/src/constants/theme';
import type { Place } from '@/src/types/trip';

const PIN_SIZE = 18;
const SELECTED_PIN_SIZE = 26;

type PlaceMarkersProps = {
  places: readonly Place[];
  selectedId: string | null;
  onSelect: (place: Place) => void;
};

const PlaceMarkers = ({ places, selectedId, onSelect }: PlaceMarkersProps) =>
  places.map((place) => {
    const selected = place.mapboxId === selectedId;
    return (
      <MarkerView
        key={place.mapboxId}
        // Mapbox reads coordinates longitude first
        coordinate={[place.lng, place.lat]}
        allowOverlap
        testID={`place-pin-${place.mapboxId}`}
      >
        <Pressable
          onPress={() => {
            haptics.selection();
            onSelect(place);
          }}
          // The pin is small, so the touch area reaches past it
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={place.name}
          accessibilityState={{ selected }}
          style={[styles.pin, selected && styles.selected]}
        />
      </MarkerView>
    );
  });

export default PlaceMarkers;

const styles = StyleSheet.create({
  pin: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: colors.tintMid,
  },
  selected: {
    width: SELECTED_PIN_SIZE,
    height: SELECTED_PIN_SIZE,
    borderWidth: 3,
    backgroundColor: colors.tint,
  },
});
