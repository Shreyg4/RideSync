/**
 * @file TripForm.tsx
 * @description The trip details fields (name, type, start date and time, cover image) shared by
 * creating, recreating and editing a trip. The parent screen decides what submitting does
 */
import { View, Text, StyleSheet, Pressable, Platform, Modal, Image, Keyboard } from 'react-native';
import React, { useState } from 'react';
import { ImagePlus, MapPin, Repeat, Calendar, Clock, X } from 'lucide-react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TextBox from '@/src/components/TextBox';
import FieldButton from '@/src/components/FieldButton';
import LargeButton from '@/src/components/LargeButton';
import SmallButton from '@/src/components/SmallButton';
import ErrorText from '@/src/components/ErrorText';
import { colors, spacing, fontSize, fontWeight, radii, contentWidth } from '@/src/constants/theme';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { TRIP_NAME_MAX_LENGTH, TRIP_TYPES, tripTypeLabel } from '@/src/domain/rules';
import { mergeDateTime } from '@/src/lib/dateTime';
import { tripImageUrl } from '@/src/lib/tripImageStorage';
import { reportAndDescribe } from '@/src/services/errors';
import type { TripFormValues, TripImageInput, TripType } from '@/src/types/trip';
import {
  CreateTripFieldErrors,
  normalizeTripName,
  validateCreateTripForm,
} from '@/src/validation/tripForms';

const TRIP_TYPE_ICONS = { 'one-way': MapPin, 'round-trip': Repeat } as const;

type TripFormProps = {
  initialValues?: Partial<TripFormValues>;
  submitLabel: string;
  scope: string;
  // Throwing shows the error under the form; resolving with a message shows that message instead
  onSubmit: (values: TripFormValues) => Promise<string | void>;
  testID?: string;
};

// Fields are seeded from initialValues once, so parents render the form after their data loads
export default function TripForm({
  initialValues,
  submitLabel,
  scope,
  onSubmit,
  testID,
}: TripFormProps) {
  const insets = useSafeAreaInsets();

  const [tripName, setTripName] = useState(initialValues?.name ?? '');
  const [startsAt, setStartsAt] = useState<Date | null>(initialValues?.startsAt ?? null);
  const [picked, setPicked] = useState({
    date: !!initialValues?.startsAt,
    time: !!initialValues?.startsAt,
  });
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [selectedType, setSelectedType] = useState<TripType | null>(
    initialValues?.tripType ?? null
  );
  const [image, setImage] = useState<TripImageInput | null>(initialValues?.image ?? null);
  const [pickingImage, setPickingImage] = useState(false);
  const [errors, setErrors] = useState<CreateTripFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);

  // A stored image is already in the bucket, a local one is only on the phone until submit
  const previewUri = image?.kind === 'stored' ? tripImageUrl(image.path) : image?.uri;

  // Drops the given fields' errors once the user changes them, so stale messages don't linger until the next submit.
  const clearErrors = (...keys: (keyof CreateTripFieldErrors)[]) =>
    setErrors((prev) =>
      keys.some((k) => prev[k])
        ? { ...prev, ...Object.fromEntries(keys.map((k) => [k, undefined])) }
        : prev
    );

  // Mode arrives as an argument instead of being read out of state
  const handlePicked = (which: 'date' | 'time') => (event: DateTimePickerEvent, value?: Date) => {
    if (event.type === 'dismissed' || !value) return;
    setStartsAt((prev) => mergeDateTime(prev, value, which));
    setPicked((p) => ({ ...p, [which]: true }));
    clearErrors('date', 'time');
  };

  // Android's picker is a system dialog, not a view, so it's opened imperatively and
  // dismisses itself.
  const openPicker = (which: 'date' | 'time') => {
    Keyboard.dismiss();
    setPickerMode(which);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: startsAt ?? new Date(),
        mode: which,
        display: which === 'date' ? 'calendar' : 'spinner',
        minimumDate: which === 'date' ? new Date() : undefined,
        // Fires on both set and dismiss, so the field's highlight clears either way
        onChange: (event, value) => {
          setPickerMode(null);
          handlePicked(which)(event, value);
        },
      });
    }
  };

  const closePicker = () => {
    setPickerMode(null);
  };

  const pickTripImage = async () => {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [5, 3],
        quality: 0.7,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setImage({ kind: 'local', uri: asset.uri, mimeType: asset.mimeType });
    } finally {
      setPickingImage(false);
    }
  };

  const handleSubmit = async () => {
    setFormError(undefined);
    const name = normalizeTripName(tripName);
    const found = validateCreateTripForm(
      { name, tripType: selectedType, startsAt, datePicked: picked.date, timePicked: picked.time },
      new Date(),
      initialValues?.startsAt
    );
    setErrors(found);
    if (Object.keys(found).length > 0 || !selectedType || !startsAt) return;

    setLoading(true);
    try {
      const message = await onSubmit({ name, tripType: selectedType, startsAt, image });
      if (message) setFormError(message);
    } catch (error) {
      setFormError(reportAndDescribe(error, { scope }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View testID={testID}>
      <TextBox
        value={tripName}
        onChangeText={(text) => {
          setTripName(text);
          clearErrors('name');
        }}
        error={!!errors.name}
        placeholder="Enter trip name"
        maxLength={TRIP_NAME_MAX_LENGTH}
        style={{ marginTop: 0 }}
      />
      <ErrorText message={errors.name} style={styles.fieldError} />

      {/* Select which type of trip this will be */}
      <View style={[styles.types, { margin: 10 }]}>
        {TRIP_TYPES.map((tripType) => {
          const Icon = TRIP_TYPE_ICONS[tripType];
          return (
            <Pressable
              key={tripType}
              onPress={() => {
                setSelectedType(tripType);
                clearErrors('tripType');
                haptics.action();
              }}
              // Styling of selected pill
              style={() => [
                {
                  backgroundColor: selectedType === tripType ? colors.tint : 'transparent',
                  width: '50%',
                  height: 70,
                  borderRadius: radii.lg,
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
            >
              <Icon color={colors.text} size={24} style={{ alignSelf: 'center' }} />
              <Text style={styles.typeText}>{tripTypeLabel(tripType)}</Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorText message={errors.tripType} style={styles.fieldError} />

      <FieldButton
        text={
          picked.date && startsAt
            ? startsAt.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
            : null
        }
        placeholder="Start Date"
        icon={Calendar}
        active={pickerMode === 'date'}
        onPress={() => openPicker('date')}
      />
      <ErrorText message={errors.date} style={styles.fieldError} />

      <FieldButton
        text={
          picked.time && startsAt
            ? startsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
            : null
        }
        placeholder="Start Time"
        icon={Clock}
        active={pickerMode === 'time'}
        onPress={() => openPicker('time')}
      />
      <ErrorText message={errors.time} style={styles.fieldError} />

      {/* Button for user to include an image */}
      <Pressable
        onPress={() => {
          haptics.action();
          pickTripImage();
        }}
        style={({ pressed }) => [
          styles.imageBox,
          previewUri && styles.imageBoxFilled,
          pressFeedback.card(pressed),
          { margin: 10 },
        ]}
      >
        {previewUri ? (
          <>
            <Image source={{ uri: previewUri }} style={styles.imagePreview} resizeMode="cover" />
            <SmallButton
              icon={X}
              onPress={() => setImage(null)}
              accessibilityLabel="Remove cover image"
              diameter={32}
              size={18}
              color={colors.text}
              backgroundColor="rgba(0, 0, 0, 0.6)"
              style={styles.removeImage}
            />
          </>
        ) : (
          <>
            <ImagePlus color={colors.textMutedLight} style={{ marginBottom: 10 }} />
            <Text style={{ color: colors.textMutedLight }}>Add cover image (optional)</Text>
          </>
        )}
      </Pressable>
      <ErrorText message={formError} style={styles.formError} />

      <LargeButton label={submitLabel} disabled={loading} onPress={handleSubmit} />

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
                backgroundColor: colors.card,
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
                minimumDate={pickerMode === 'date' ? new Date() : undefined}
                onChange={handlePicked(pickerMode ?? 'date')}
                style={{ alignSelf: 'center' }}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'center', padding: 10 }}>
                <Pressable onPress={closePicker} hitSlop={12} style={styles.doneButton}>
                  <Text
                    style={{
                      color: colors.background,
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
}

const styles = StyleSheet.create({
  imageBox: {
    backgroundColor: colors.card,
    borderColor: colors.textMutedLight,
    width: contentWidth,
    aspectRatio: 5 / 3,
    borderWidth: 1,
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  types: {
    backgroundColor: colors.card,
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
    color: colors.text,
    fontSize: 10,
    alignSelf: 'center',
  },
  doneButton: {
    backgroundColor: colors.tint,
    paddingHorizontal: 90,
    paddingVertical: 10,
    borderRadius: radii.lg,
  },
  imageBoxFilled: {
    borderStyle: 'solid',
    borderColor: colors.border,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImage: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  formError: {
    alignSelf: 'center',
  },
  fieldError: {
    marginLeft: spacing.md,
  },
});
