import { View, Text, StyleSheet, Pressable, Platform, Modal, Image, Keyboard } from 'react-native';
import React, { useState } from 'react';
import TextBox from '@components/TextBox';
import { colors, spacing, fontSize, fontWeight, radii, contentWidth } from '@/src/constants/theme';
import { ImagePlus, MapPin, Repeat, Calendar, Clock, X } from 'lucide-react-native';
import { haptics } from '../constants/haptics';
import { pressFeedback } from '../constants/pressFeedback';
import LargeButton from '@/src/components/LargeButton';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '@/src/components/Screen';
import ScreenHeader from '@/src/components/ScreenHeader';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import FieldButton from '@/src/components/FieldButton';
import { TRIP_NAME_MAX_LENGTH, TRIP_TYPES, tripTypeLabel } from '@/src/domain/rules';
import { mergeDateTime } from '@/src/lib/dateTime';
import * as ImagePicker from 'expo-image-picker';
import SmallButton from '../components/SmallButton';
import ErrorText from '../components/ErrorText';
import { TripType } from '../types/trip';
import {
  CreateTripFieldErrors,
  normalizeTripName,
  validateCreateTripForm,
} from '../validation/tripForms';
import { useAuth } from '../context/AuthProvider';
import { createTripWithImage } from '../services/tripCreationService';
import { reportAndDescribe } from '../services/errors';

const TRIP_TYPE_ICONS = { 'one-way': MapPin, 'round-trip': Repeat } as const;

const CreateTripScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tripName, setTripName] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [picked, setPicked] = useState({ date: false, time: false });
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [selectedType, setSelectedType] = useState<TripType | null>(null);
  const [errors, setErrors] = useState<CreateTripFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [tripImageAsset, setTripImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);

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
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      setFormError('Photo access is off. Enable it in Settings to pick a picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, // gives user crop step
      aspect: [5, 3], // box crop
      quality: 0.7, // JPEG compression
    });

    if (result.canceled) return;
    setTripImageAsset(result.assets[0]);
  };

  const handleCreateTrip = async () => {
    setFormError(undefined);
    const name = normalizeTripName(tripName);
    const found = validateCreateTripForm({
      name,
      tripType: selectedType,
      startsAt,
      datePicked: picked.date,
      timePicked: picked.time,
    });
    setErrors(found);
    if (Object.keys(found).length > 0 || !selectedType || !startsAt) return;

    if (!user) {
      setFormError('You need to be signed in to create a trip.');
      return;
    }

    setLoading(true);
    try {
      await createTripWithImage({
        userId: user.id,
        name,
        tripType: selectedType,
        startsAt,
        image: tripImageAsset
          ? { uri: tripImageAsset.uri, mimeType: tripImageAsset.mimeType }
          : null,
      });
      router.replace('/(tabs)/trips');
    } catch (error) {
      setFormError(reportAndDescribe(error, { scope: 'createTrip.handleCreateTrip' }));
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen scroll gradient bottomOffset={spacing.lg}>
        <ScreenHeader
          title="Create Trip"
          onBack={Platform.OS === 'android' ? () => router.dismiss() : undefined}
          applyTopInset={Platform.OS === 'android'}
          style={{ paddingVertical: spacing.xl }}
        />

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
            tripImageAsset && styles.imageBoxFilled,
            pressFeedback.card(pressed),
            { margin: 10 },
          ]}
        >
          {tripImageAsset ? (
            <>
              <Image
                source={{ uri: tripImageAsset.uri }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <SmallButton
                icon={X}
                onPress={() => setTripImageAsset(null)}
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

        <LargeButton label="Create Trip" disabled={loading} onPress={handleCreateTrip} />
      </Screen>
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
};

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
export default CreateTripScreen;
