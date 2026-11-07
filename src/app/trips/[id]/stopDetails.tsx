/**
 * @file stopDetails.tsx
 * @description The last step of adding a stop: shows the picked place on a map, lets the user adjust
 * its details, and saves it to the trip
 */
import { MarkerView } from '@rnmapbox/maps';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import Chip from '@/src/components/Chip';
import EmptyState from '@/src/components/EmptyState';
import ErrorText from '@/src/components/ErrorText';
import LargeButton from '@/src/components/LargeButton';
import Screen from '@/src/components/Screen';
import ScreenHeader from '@/src/components/ScreenHeader';
import TextBox from '@/src/components/TextBox';
import TripMap from '@/src/components/TripMap';
import { haptics } from '@/src/constants/haptics';
import {
  colors,
  contentWidth,
  fontSize,
  fontWeight,
  gradients,
  radii,
  spacing,
} from '@/src/constants/theme';
import {
  addStopLabel,
  canStayOvernight,
  parseNextStopType,
  parseStopPosition,
  STOP_CATEGORIES,
  STOP_NAME_MAX_LENGTH,
  STOP_NOTES_MAX_LENGTH,
  stopCategoryLabel,
} from '@/src/domain/rules';
import type { NextStopType } from '@/src/domain/rules';
import { parsePlaceParam } from '@/src/lib/placeParam';
import { reportAndDescribe } from '@/src/services/errors';
import { addTripStop } from '@/src/services/tripStopService';
import type { Place, StopCategory } from '@/src/types/trip';
import { validateStopForm } from '@/src/validation/tripForms';
import type { StopFieldErrors } from '@/src/validation/tripForms';

// Close enough to tell a place from its neighbours
const PREVIEW_ZOOM = 15;

type StopDetailsFormProps = {
  tripId: number;
  place: Place;
  stopType: NextStopType;
  atPosition?: number;
};

// Fields are seeded from the place once, so the screen renders this only after the place is known
const StopDetailsForm = ({ tripId, place, stopType, atPosition }: StopDetailsFormProps) => {
  const [name, setName] = useState(place.name);
  const [category, setCategory] = useState<StopCategory>(place.category);
  const [notes, setNotes] = useState('');
  const [overnight, setOvernight] = useState(false);
  const [errors, setErrors] = useState<StopFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setFormError(undefined);
    const found = validateStopForm({ name, notes });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await addTripStop(tripId, {
        stop_name: name.trim(),
        stop_lat: place.lat,
        stop_lng: place.lng,
        stop_address: place.address ?? undefined,
        stop_mapbox_id: place.mapboxId,
        new_stop_type: canStayOvernight(stopType) ? (overnight ? 'overnight' : 'stop') : stopType,
        stop_category: category,
        stop_notes: notes.trim() || undefined,
        at_position: atPosition,
        stop_is_turnaround: stopType === 'destination',
      });
      // Closes this screen and the search under it. The planner reloads when it regains focus
      router.dismissTo(`/trips/${tripId}/planner`);
    } catch (error) {
      setFormError(reportAndDescribe(error, { scope: 'StopDetailsScreen.handleSave' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen bottomOffset={spacing.lg}>
      {/* Only a preview, so a drag that starts here scrolls the form instead of panning the map */}
      <View style={styles.map} pointerEvents="none" testID="stop-details-map-box">
        <TripMap initialCenter={place} initialZoom={PREVIEW_ZOOM} testID="stop-details-map">
          {/* Mapbox reads coordinates longitude first. The anchor rests the pin's tip on the place */}
          <MarkerView
            coordinate={[place.lng, place.lat]}
            anchor={{ x: 0.5, y: 1 }}
            allowOverlap
            testID="stop-details-pin"
          >
            <MapPin color={colors.tint} fill={colors.background} size={36} />
          </MarkerView>
        </TripMap>
      </View>

      <TextBox
        value={name}
        onChangeText={(text) => {
          setName(text);
          setErrors((prev) => ({ ...prev, name: undefined }));
        }}
        placeholder="Stop name"
        maxLength={STOP_NAME_MAX_LENGTH}
        error={!!errors.name}
        testID="stop-name-input"
      />
      <ErrorText message={errors.name} style={styles.fieldError} testID="stop-name-error" />

      {place.address ? <Text style={styles.address}>{place.address}</Text> : null}

      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>
        {STOP_CATEGORIES.map((value) => (
          <Chip
            key={value}
            label={stopCategoryLabel(value)}
            selected={category === value}
            onPress={() => setCategory(value)}
            testID={`stop-category-${value}`}
          />
        ))}
      </View>

      {canStayOvernight(stopType) ? (
        <View style={styles.overnight}>
          <View style={styles.overnightText}>
            <Text style={styles.overnightTitle}>Overnight stay</Text>
            <Text style={styles.overnightHint}>Ends this day of the trip</Text>
          </View>
          <Switch
            value={overnight}
            onValueChange={(value) => {
              haptics.selection();
              setOvernight(value);
            }}
            trackColor={{ true: colors.tint }}
            accessibilityLabel="Overnight stay"
            testID="stop-overnight-switch"
          />
        </View>
      ) : null}

      <TextBox
        value={notes}
        onChangeText={(text) => {
          setNotes(text);
          setErrors((prev) => ({ ...prev, notes: undefined }));
        }}
        placeholder="Notes (optional)"
        maxLength={STOP_NOTES_MAX_LENGTH}
        multiline
        height={100}
        error={!!errors.notes}
        style={styles.notes}
        testID="stop-notes-input"
      />
      <ErrorText message={errors.notes} style={styles.fieldError} testID="stop-notes-error" />

      <ErrorText message={formError} style={styles.formError} testID="stop-save-error" />
      <LargeButton
        label={addStopLabel(stopType)}
        disabled={saving}
        onPress={handleSave}
        testID="stop-save-button"
      />
    </Screen>
  );
};

const StopDetailsScreen = () => {
  const params = useLocalSearchParams<{
    id: string | string[];
    place?: string;
    stopType?: string;
    atPosition?: string;
  }>();
  const tripId = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const place = parsePlaceParam(params.place);
  const stopType = parseNextStopType(params.stopType);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Same as the planner: the gradient only spans the header */}
      <View>
        <LinearGradient
          pointerEvents="none"
          {...gradients.cardToBackground()}
          style={StyleSheet.absoluteFill}
        />
        <ScreenHeader title={addStopLabel(stopType)} onBack={() => router.back()} />
      </View>

      {place ? (
        <StopDetailsForm
          tripId={tripId}
          place={place}
          stopType={stopType}
          atPosition={parseStopPosition(params.atPosition)}
        />
      ) : (
        <EmptyState title="Couldn't open that place" />
      )}
    </View>
  );
};

export default StopDetailsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Same size and shape as the map preview on the search screen
  map: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    width: contentWidth,
    aspectRatio: 5 / 3,
    alignSelf: 'center',
    margin: spacing.sm,
    overflow: 'hidden',
  },
  address: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    margin: spacing.md,
    marginTop: spacing.sm,
  },
  overnight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    width: contentWidth,
    alignSelf: 'center',
    padding: spacing.md,
  },
  overnightText: {
    flex: 1,
  },
  overnightTitle: {
    color: colors.text,
    fontSize: fontSize.body,
  },
  overnightHint: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
  },
  // Lines the text up with the top of the box, since it can run over several lines
  notes: {
    paddingTop: spacing.md,
    paddingRight: spacing.md,
    textAlignVertical: 'top',
  },
  fieldError: {
    marginLeft: spacing.md,
  },
  formError: {
    alignSelf: 'center',
  },
});
