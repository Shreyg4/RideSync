/**
 * @file DepartureField.tsx
 * @description When the group leaves an overnight stop: a date and a time button, each opening the
 * native picker. With no value the itinerary assumes the next morning, so empty is a valid answer
 */
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar, Clock } from 'lucide-react-native';
import React, { useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FieldButton from '@/src/components/FieldButton';
import { colors, contentWidth, fontSize, fontWeight, radii, spacing } from '@/src/constants/theme';
import { formatShortDate, mergeDateTime, type DateTimePart } from '@/src/lib/dateTime';

type DepartureFieldProps = {
  value: Date | null;
  onChange: (value: Date | null) => void;
  minimumDate: Date; // the first day the itinerary accepts a departure on
  defaultValue: Date; // where the pickers open, and what the other half fills from, when empty
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function DepartureField({
  value,
  onChange,
  minimumDate,
  defaultValue,
}: DepartureFieldProps) {
  const insets = useSafeAreaInsets();
  const [pickerMode, setPickerMode] = useState<DateTimePart | null>(null);

  // Picking only one half keeps the other from the current value, or from the default
  const handlePicked = (part: DateTimePart) => (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === 'dismissed' || !picked) return;
    onChange(mergeDateTime(value ?? defaultValue, picked, part));
  };

  // Android's picker is a system dialog, opened imperatively, that closes itself
  const openPicker = (part: DateTimePart) => {
    Keyboard.dismiss();
    setPickerMode(part);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: value ?? defaultValue,
        mode: part,
        display: part === 'date' ? 'calendar' : 'spinner',
        minimumDate: part === 'date' ? minimumDate : undefined,
        onChange: (event, picked) => {
          setPickerMode(null);
          handlePicked(part)(event, picked);
        },
      });
    }
  };

  const closePicker = () => setPickerMode(null);

  return (
    <View>
      <FieldButton
        text={value ? formatShortDate(value) : null}
        placeholder="Leaves the next morning"
        icon={Calendar}
        active={pickerMode === 'date'}
        onPress={() => openPicker('date')}
        testID="stop-departure-date"
      />
      <FieldButton
        text={value ? formatTime(value) : null}
        placeholder="Departure time"
        icon={Clock}
        active={pickerMode === 'time'}
        onPress={() => openPicker('time')}
        testID="stop-departure-time"
      />
      {value ? (
        <Pressable
          onPress={() => onChange(null)}
          hitSlop={8}
          accessibilityRole="button"
          style={styles.clear}
          testID="stop-departure-clear"
        >
          <Text style={styles.clearText}>Clear departure</Text>
        </Pressable>
      ) : null}

      {/* iOS only: Android opens its own dialog from openPicker */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={pickerMode !== null}
          transparent
          animationType="slide"
          onRequestClose={closePicker}
        >
          <Pressable style={styles.backdrop} onPress={closePicker}>
            {/* Swallows taps so pressing the sheet itself doesn't close it */}
            <Pressable onPress={() => {}} style={[styles.sheet, { paddingBottom: insets.bottom }]}>
              <DateTimePicker
                value={value ?? defaultValue}
                mode={pickerMode ?? 'date'}
                display={pickerMode === 'date' ? 'inline' : 'spinner'}
                themeVariant="dark"
                minimumDate={pickerMode === 'date' ? minimumDate : undefined}
                onChange={handlePicked(pickerMode ?? 'date')}
                style={styles.picker}
              />
              <View style={styles.doneRow}>
                <Pressable onPress={closePicker} hitSlop={12} style={styles.doneButton}>
                  <Text style={styles.doneText}>Done</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clear: {
    width: contentWidth,
    alignSelf: 'center',
  },
  clearText: {
    color: colors.tint,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  picker: {
    alignSelf: 'center',
  },
  doneRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  doneButton: {
    backgroundColor: colors.tint,
    paddingHorizontal: 90,
    paddingVertical: 10,
    borderRadius: radii.lg,
  },
  doneText: {
    color: colors.background,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
