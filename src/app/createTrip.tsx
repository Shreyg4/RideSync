import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Modal } from 'react-native';
import React, { useState } from 'react';
import TextBox from '@components/textbox';
import Colors from '@/src/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { ImagePlus, MapPin, Repeat, ChevronLeft, Calendar, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import LargeButton from '@/src/components/largeButton';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SmallButton from '@/src/components/smallButton';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import FieldButton from '@/src/components/fieldButton';

const TRIP_TYPES = [
  { value: 'one-way', icon: MapPin },
  { value: 'round-trip', icon: Repeat },
] as const;

const tripTypeLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const CreateTripScreen = () => {
  const insets = useSafeAreaInsets();

  const [tripName, setTripName] = useState('');

  const [when, setWhen] = useState<Date | null>(null);
  const [mode, setMode] = useState<'date' | 'time' | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Mode arrives as an argument instead of being read out of state
  const onPicked = (which: 'date' | 'time') => (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === 'dismissed' || !picked) return;
    setWhen((prev) => {
      // Copy the existing instant so editing one half preserves the other.
      const next = new Date(prev ?? new Date());
      if (which === 'date')
        next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
      else next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      return next;
    });
  };

  // Android's picker is a system dialog, not a view, so it's opened imperatively and
  // dismisses itself. iOS renders inline, so there `mode` drives the Modal below.
  const open = (which: 'date' | 'time') => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: when ?? new Date(),
        mode: which,
        display: which === 'date' ? 'calendar' : 'spinner',
        onChange: onPicked(which),
      });
      return;
    }
    setMode(which);
  };

  const onDone = () => {
    setMode(null);
  };
  return (
    <View style={{ paddingTop: Platform.select({ ios: 0, android: insets.top }) }}>
      <LinearGradient
        colors={[Colors.theme.card, Colors.theme.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.3 }}
        style={StyleSheet.absoluteFill}
      />
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
          placeholder="Enter trip name"
          style={{ marginTop: 0 }}
        />

        {/* Select which type of trip this will be */}
        <View style={[styles.types, { margin: 10 }]}>
          {TRIP_TYPES.map((tripType) => {
            const Icon = tripType.icon;
            return (
              <Pressable
                key={tripType.value}
                onPress={() => {
                  setSelectedType(tripType.value);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                // Styling of selected pill
                style={() => [
                  {
                    backgroundColor:
                      selectedType === tripType.value ? Colors.theme.tint : 'transparent',
                    width: '50%',
                    height: 70,
                    borderRadius: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                ]}
              >
                <Icon color={Colors.theme.text} size={24} style={{ alignSelf: 'center' }} />
                <Text style={styles.typeText}>{tripTypeLabel(tripType.value)}</Text>
              </Pressable>
            );
          })}
        </View>

        <FieldButton
          text={
            when &&
            when.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
          }
          placeholder="Start Date"
          icon={Calendar}
          onPress={() => open('date')}
        />

        <FieldButton
          text={when && when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          placeholder="Start Time"
          icon={Clock}
          onPress={() => open('time')}
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
          <ImagePlus color={Colors.theme.textMutedLight} style={{ marginBottom: 10 }} />
          <Text style={{ color: Colors.theme.textMutedLight }}>Add cover image (optional)</Text>
        </Pressable>

        <LargeButton
          label="Create Trip"
          disabled={false}
          onPress={() => router.replace('/planner')}
        />
      </ScrollView>
      {/* iOS only - Android opens its own dialog from open() above. */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={mode !== null}
          transparent
          animationType="slide"
          onRequestClose={onDone} // Android back button; harmless on iOS, good habit
        >
          {/* Backdrop: fills the screen, pushes the card to the bottom, dismisses on tap */}
          <Pressable
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={onDone}
          >
            {/* Swallow taps so pressing the card itself doesn't close it */}
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: Colors.theme.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: insets.bottom,
              }}
            >
              <DateTimePicker
                value={when ?? new Date()}
                mode={mode ?? 'date'} // required prop; `visible` is false when null anyway
                display={mode === 'date' ? 'inline' : 'spinner'}
                themeVariant="dark"
                onChange={onPicked(mode ?? 'date')}
                style={{ alignSelf: 'center' }}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'center', padding: 10 }}>
                <Pressable onPress={onDone} hitSlop={12} style={styles.doneButton}>
                  <Text style={{ color: Colors.theme.background, fontSize: 17, fontWeight: '600' }}>
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
    color: Colors.theme.text,
    fontSize: 30,
    fontWeight: '600',
    alignSelf: 'center',
  },
  imageBox: {
    backgroundColor: Colors.theme.card,
    borderColor: Colors.theme.textMutedLight,
    width: '95%',
    aspectRatio: 1.6,
    borderWidth: 1,
    borderRadius: 20,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  types: {
    backgroundColor: Colors.theme.card,
    width: '95%',
    height: 70,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  typeText: {
    color: Colors.theme.text,
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
    backgroundColor: Colors.theme.tint,
    paddingHorizontal: 90,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
export default CreateTripScreen;
