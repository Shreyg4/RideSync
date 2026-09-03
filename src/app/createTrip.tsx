import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Modal } from 'react-native';
import React, { useState } from 'react';
import TextBox from '@components/TextBox';
import Colors from '@/src/constants/colors';
import { contentWidth } from '@/src/constants/layout';
import { radii } from '@/src/constants/radii';
import { gradients } from '@/src/constants/gradients';
import { fontSize, fontWeight } from '@/src/constants/typography';
import { copy } from '@/src/constants/copy';
import { LinearGradient } from 'expo-linear-gradient';
import { ImagePlus, MapPin, Repeat, ChevronLeft, Calendar, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import LargeButton from '@/src/components/LargeButton';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SmallButton from '@/src/components/SmallButton';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import FieldButton from '@/src/components/FieldButton';
import { TRIP_TYPES, tripTypeLabel } from '@/src/domain/rules';
import { mergeDateTime } from '@/src/lib/dateTime';

const TRIP_TYPE_ICONS = { 'one-way': MapPin, 'round-trip': Repeat } as const;

const CreateTripScreen = () => {
  const insets = useSafeAreaInsets();

  const [tripName, setTripName] = useState('');

  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Mode arrives as an argument instead of being read out of state
  const handlePicked = (which: 'date' | 'time') => (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === 'dismissed' || !picked) return;
    setStartsAt((prev) => mergeDateTime(prev, picked, which));
  };

  // Android's picker is a system dialog, not a view, so it's opened imperatively and
  // dismisses itself. iOS renders inline, so there `pickerMode` drives the Modal below.
  const openPicker = (which: 'date' | 'time') => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: startsAt ?? new Date(),
        mode: which,
        display: which === 'date' ? 'calendar' : 'spinner',
        onChange: handlePicked(which),
      });
      return;
    }
    setPickerMode(which);
  };

  const closePicker = () => {
    setPickerMode(null);
  };
  return (
    <View style={{ paddingTop: Platform.select({ ios: 0, android: insets.top }) }}>
      <LinearGradient {...gradients.cardToBackground} style={StyleSheet.absoluteFill} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="never"
      >
        <View style={[styles.headerRow]}>
          <Text style={styles.title}>Create Trip</Text>
          {Platform.OS === 'android' && (
            <View style={styles.headerLeft}>
              <SmallButton
                icon={ChevronLeft}
                onPress={() => router.dismiss()}
                style={{ left: 10 }}
              />
            </View>
          )}
        </View>

        <TextBox
          value={tripName}
          onChangeText={setTripName}
          placeholder={copy.fields.tripName}
          style={{ marginTop: 0 }}
        />

        {/* Select which type of trip this will be */}
        <View style={[styles.types, { margin: 10 }]}>
          {TRIP_TYPES.map((tripType) => {
            const Icon = TRIP_TYPE_ICONS[tripType];
            return (
              <Pressable
                key={tripType}
                onPress={() => {
                  setSelectedType(tripType);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                // Styling of selected pill
                style={() => [
                  {
                    backgroundColor: selectedType === tripType ? Colors.tint : 'transparent',
                    width: '50%',
                    height: 70,
                    borderRadius: radii.lg,
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                ]}
              >
                <Icon color={Colors.text} size={24} style={{ alignSelf: 'center' }} />
                <Text style={styles.typeText}>{tripTypeLabel(tripType)}</Text>
              </Pressable>
            );
          })}
        </View>

        <FieldButton
          text={
            startsAt &&
            startsAt.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
          }
          placeholder="Start Date"
          icon={Calendar}
          onPress={() => openPicker('date')}
        />

        <FieldButton
          text={
            startsAt &&
            startsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
          }
          placeholder="Start Time"
          icon={Clock}
          onPress={() => openPicker('time')}
        />
        {/* Button for user to include an image */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={({ pressed }) => [
            styles.imageBox,
            {
              transform: [{ scale: pressed ? 0.95 : 1 }],
              opacity: pressed ? 0.85 : 1,
              margin: 10,
            },
          ]}
        >
          <ImagePlus color={Colors.textMutedLight} style={{ marginBottom: 10 }} />
          <Text style={{ color: Colors.textMutedLight }}>Add cover image (optional)</Text>
        </Pressable>

        <LargeButton
          label="Create Trip"
          disabled={false}
          onPress={() => router.replace('/planner')}
        />
      </ScrollView>
      {/* iOS only - Android opens its own dialog from openPicker() above. */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={pickerMode !== null}
          transparent
          animationType="slide"
          onRequestClose={closePicker} // Android back button; harmless on iOS, good habit
        >
          {/* Backdrop: fills the screen, pushes the card to the bottom, dismisses on tap */}
          <Pressable
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={closePicker}
          >
            {/* Swallow taps so pressing the card itself doesn't close it */}
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: Colors.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: insets.bottom,
              }}
            >
              <DateTimePicker
                value={startsAt ?? new Date()}
                mode={pickerMode ?? 'date'} // required prop; `visible` is false when null anyway
                display={pickerMode === 'date' ? 'inline' : 'spinner'}
                themeVariant="dark"
                onChange={handlePicked(pickerMode ?? 'date')}
                style={{ alignSelf: 'center' }}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'center', padding: 10 }}>
                <Pressable onPress={closePicker} hitSlop={12} style={styles.doneButton}>
                  <Text
                    style={{
                      color: Colors.background,
                      fontSize: fontSize.body,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    Done
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    color: Colors.text,
    fontSize: fontSize.sheetTitle,
    fontWeight: fontWeight.semibold,
    alignSelf: 'center',
  },
  imageBox: {
    backgroundColor: Colors.card,
    borderColor: Colors.textMutedLight,
    width: contentWidth,
    aspectRatio: 1.6,
    borderWidth: 1,
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  types: {
    backgroundColor: Colors.card,
    width: contentWidth,
    height: 70,
    borderRadius: radii.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  typeText: {
    color: Colors.text,
    fontSize: 10,
    alignSelf: 'center',
  },
  headerRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  headerLeft: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  doneButton: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 90,
    paddingVertical: 10,
    borderRadius: radii.lg,
  },
});
export default CreateTripScreen;
