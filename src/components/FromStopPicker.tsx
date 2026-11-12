/**
 * @file FromStopPicker.tsx
 * @description Which stop the search map looks around, and the stop a new one is added after. Stops
 * are numbered as their pins are
 */
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { colors, fontSize, fontWeight, radii, spacing } from '@/src/constants/theme';
import type { TripStop } from '@/src/types/trip';

// Room for about five stops before the list scrolls, so it never covers the whole map
const LIST_MAX_HEIGHT = 240;

type FromStopPickerProps = {
  stops: readonly TripStop[]; // the stops that can be picked, in trip order
  selected: TripStop;
  onSelect: (stop: TripStop) => void;
};

// Positions run from 0 in trip order, so this matches the pin's number
const stopTitle = (stop: TripStop) => `${stop.position + 1} · ${stop.name}`;

const FromStopPicker = ({ stops, selected, onSelect }: FromStopPickerProps) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => {
          haptics.selection();
          setOpen((wasOpen) => !wasOpen);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Searching from stop ${stopTitle(selected)}`}
        accessibilityHint="Choose the stop to search around and add after"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.pill, pressFeedback.control(pressed)]}
        testID="from-stop-picker"
      >
        <Text style={styles.label}>From</Text>
        <Text style={styles.value} numberOfLines={1}>
          {stopTitle(selected)}
        </Text>
        <ChevronDown color={colors.textMutedLight} size={16} />
      </Pressable>

      {open ? (
        <ScrollView style={styles.list} testID="from-stop-list">
          {stops.map((stop) => (
            <Pressable
              key={stop.id}
              onPress={() => {
                haptics.selection();
                setOpen(false);
                onSelect(stop);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: stop.id === selected.id }}
              style={({ pressed }) => [styles.row, pressFeedback.card(pressed)]}
              testID={`from-stop-${stop.id}`}
            >
              <Text
                style={[styles.rowText, stop.id === selected.id && styles.selectedText]}
                numberOfLines={1}
              >
                {stopTitle(stop)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
};

export default FromStopPicker;

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    maxWidth: '100%',
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  label: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
  },
  // Shrinks a long stop name so the arrow stays on the pill
  value: {
    flexShrink: 1,
    color: colors.text,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
  },
  list: {
    alignSelf: 'stretch',
    maxHeight: LIST_MAX_HEIGHT,
    marginTop: spacing.xxs,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowText: {
    color: colors.text,
    fontSize: fontSize.body,
  },
  selectedText: {
    color: colors.tint,
    fontWeight: fontWeight.semibold,
  },
});
