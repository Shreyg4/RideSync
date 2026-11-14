/**
 * @file stopDetails.tsx
 * @description One stop, on a map with its details. Reached three ways:
 * - from search with a picked place, to add it to the trip
 * - from the planner with a stopId, to edit or remove it (a viewer only sees it)
 * - from search with both, after Change place, to move that stop to the picked place
 */
import { MarkerView } from '@rnmapbox/maps';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { MapPin, Navigation, Trash2 } from 'lucide-react-native';
import React, { useState, type ReactNode } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import Chip from '@/src/components/Chip';
import DepartureField from '@/src/components/DepartureField';
import EmptyState from '@/src/components/EmptyState';
import ErrorText from '@/src/components/ErrorText';
import LargeButton from '@/src/components/LargeButton';
import LoadingState from '@/src/components/LoadingState';
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
import { useAuth } from '@/src/context/AuthProvider';
import {
  addStopLabel,
  canRemoveStop,
  canStayOvernight,
  defaultDeparture,
  earliestDepartureDay,
  itineraryRows,
  newStopArrivalDay,
  parseNextStopType,
  parseStopId,
  parseStopPosition,
  STOP_CATEGORIES,
  STOP_NAME_MAX_LENGTH,
  STOP_NOTES_MAX_LENGTH,
  stopArrivalDay,
  stopCategoryLabel,
  stopLabel,
  stopRole,
} from '@/src/domain/rules';
import type { NextStopType } from '@/src/domain/rules';
import { useAsync } from '@/src/hooks/useAsync';
import { formatShortDate, formatTime } from '@/src/lib/dateTime';
import { openNavigation } from '@/src/lib/navigation';
import { parsePlaceParam } from '@/src/lib/placeParam';
import { toTrip, toTripMember, toTripStop } from '@/src/lib/tripMapper';
import { reportAndDescribe } from '@/src/services/errors';
import { getTrip, listTripMembers } from '@/src/services/tripService';
import {
  addTripStop,
  listTripStops,
  removeTripStop,
  updateTripStop,
} from '@/src/services/tripStopService';
import type { TripStopChanges } from '@/src/services/tripStopService';
import type { Place, StopCategory, TripStop } from '@/src/types/trip';
import { validateStopForm } from '@/src/validation/tripForms';
import type { StopFieldErrors } from '@/src/validation/tripForms';

// Close enough to tell a place from its neighbours
const PREVIEW_ZOOM = 15;

type PreviewPlace = Pick<Place, 'name' | 'address' | 'lat' | 'lng'>;

type FormMode =
  | {
      kind: 'add';
      place: Place;
      stopType: NextStopType;
      atPosition?: number;
      arrivalDay?: Date; // when the group would get there; unknown until the trip has loaded
    }
  | {
      kind: 'edit';
      stop: TripStop;
      newPlace: Place | null; // set after Change place, and then saved over the stop's own place
      arrivalDay?: Date; // when the group gets there; unknown only if it's not in the itinerary
    };

const plannerHref = (tripId: number) => `/trips/${tripId}/planner` as const;

// A saved stop has no Mapbox category list, only the category it was saved with
const placeOfStop = (stop: TripStop): PreviewPlace => ({
  name: stop.name,
  address: stop.address,
  lat: stop.lat,
  lng: stop.lng,
});

// Only a preview, so a drag that starts here scrolls the form instead of panning the map
const PlacePreview = ({ place }: { place: PreviewPlace }) => (
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
);

type StopDetailsFormProps = {
  tripId: number;
  mode: FormMode;
};

// Fields are seeded once, so the screen renders this only after the place or stop is known
const StopDetailsForm = ({ tripId, mode }: StopDetailsFormProps) => {
  const stop = mode.kind === 'edit' ? mode.stop : null;
  // A saved stop opened as it is, rather than one being moved to a new place
  const editingInPlace = mode.kind === 'edit' && !mode.newPlace ? mode.stop : null;
  // A picked place: the one being added, or the one a stop is moving to
  const pickedPlace = mode.kind === 'add' ? mode.place : mode.newPlace;
  const place: PreviewPlace =
    mode.kind === 'add' ? mode.place : (mode.newPlace ?? placeOfStop(mode.stop));
  const role = mode.kind === 'add' ? mode.stopType : stopRole(mode.stop);

  // A moved stop takes the new place's name and category, but keeps its notes and overnight plan
  const [name, setName] = useState(pickedPlace?.name ?? stop?.name ?? '');
  const [category, setCategory] = useState<StopCategory>(
    pickedPlace?.category ?? stop?.stopCategory ?? 'other'
  );
  const [notes, setNotes] = useState(stop?.notes ?? '');
  const [overnight, setOvernight] = useState(stop?.stopType === 'overnight');
  const [departsAt, setDepartsAt] = useState<Date | null>(stop?.departsAt ?? null);
  const [errors, setErrors] = useState<StopFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const arrivalDay = mode.arrivalDay;

  const saveStop = async () => {
    if (mode.kind === 'add') {
      await addTripStop(tripId, {
        stop_name: name.trim(),
        stop_lat: mode.place.lat,
        stop_lng: mode.place.lng,
        stop_address: mode.place.address ?? undefined,
        stop_mapbox_id: mode.place.mapboxId,
        new_stop_type: canStayOvernight(role) ? (overnight ? 'overnight' : 'stop') : role,
        stop_category: category,
        stop_notes: notes.trim() || undefined,
        at_position: mode.atPosition,
        stop_is_turnaround: role === 'destination',
        // Saved with the stop, so it can't be added without the time the group leaves it
        stop_departs_at: overnight && departsAt ? departsAt.toISOString() : undefined,
      });
      return;
    }

    const changes: TripStopChanges = {
      name: name.trim(),
      category,
      notes: notes.trim() || null,
    };
    if (mode.newPlace) {
      changes.lat = mode.newPlace.lat;
      changes.lng = mode.newPlace.lng;
      changes.address = mode.newPlace.address;
      changes.mapbox_id = mode.newPlace.mapboxId;
    }
    // Start and end can't change type, so they aren't sent one. A stop that stops being overnight
    // loses its departure; updateTripStop clears it too
    if (canStayOvernight(role)) {
      changes.stop_type = overnight ? 'overnight' : 'stop';
      changes.departs_at = overnight && departsAt ? departsAt.toISOString() : null;
    }
    await updateTripStop(mode.stop.id, changes);
  };

  const handleSave = async () => {
    setFormError(undefined);
    const found = validateStopForm({ name, notes });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await saveStop();
      // Closes this screen, and search under it if there is one. The planner reloads on focus
      router.dismissTo(plannerHref(tripId));
    } catch (error) {
      setFormError(reportAndDescribe(error, { scope: 'StopDetailsScreen.handleSave' }));
    } finally {
      setSaving(false);
    }
  };

  const removeStop = async (stopId: number) => {
    setFormError(undefined);
    setSaving(true);
    try {
      await removeTripStop(stopId);
      router.dismissTo(plannerHref(tripId));
    } catch (error) {
      setFormError(reportAndDescribe(error, { scope: 'StopDetailsScreen.removeStop' }));
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = (target: TripStop) =>
    Alert.alert(`Remove ${target.name}?`, 'It comes off the itinerary for everyone on the trip.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeStop(target.id) },
    ]);

  // Search hands the picked place back to a new preview of this stop, which saves it
  const changePlace = (target: TripStop) =>
    router.push({
      pathname: '/trips/[id]/addStop',
      params: { id: tripId, stopType: role, stopId: target.id },
    });

  return (
    <Screen bottomOffset={spacing.lg}>
      <PlacePreview place={place} />

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

      {editingInPlace ? (
        <>
          <NavigateButton place={editingInPlace} />
          <LargeButton
            icon={MapPin}
            label="Change place"
            variant="dashed"
            onPress={() => changePlace(editingInPlace)}
            testID="stop-change-place"
          />
        </>
      ) : null}

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

      {canStayOvernight(role) ? (
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

      {/* Shown as soon as the stay is switched on, for a new stop as well as a saved one */}
      {overnight && arrivalDay ? (
        <DepartureField
          value={departsAt}
          onChange={setDepartsAt}
          minimumDate={earliestDepartureDay(arrivalDay)}
          defaultValue={defaultDeparture(arrivalDay)}
        />
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
        label={mode.kind === 'add' ? addStopLabel(role) : 'Save changes'}
        disabled={saving}
        onPress={handleSave}
        testID="stop-save-button"
      />
      {editingInPlace && canRemoveStop(editingInPlace) ? (
        <LargeButton
          icon={Trash2}
          label="Remove stop"
          variant="danger"
          disabled={saving}
          onPress={() => confirmRemove(editingInPlace)}
          testID="stop-remove-button"
        />
      ) : null}
    </Screen>
  );
};

// Driving directions to a saved stop, in the phone's maps app
const NavigateButton = ({ place }: { place: TripStop }) => (
  <LargeButton
    icon={Navigation}
    label="Navigate"
    variant="dashed"
    onPress={() => openNavigation(place)}
    testID="stop-navigate"
  />
);

// What a viewer sees: the same details, with nothing to change
const StopSummary = ({ stop }: { stop: TripStop }) => (
  <Screen bottomOffset={spacing.lg}>
    <PlacePreview place={placeOfStop(stop)} />
    <Text style={styles.summaryName} testID="stop-summary-name">
      {stop.name}
    </Text>
    {stop.address ? <Text style={styles.address}>{stop.address}</Text> : null}
    <NavigateButton place={stop} />
    <Text style={styles.summaryLine}>{stopLabel(stop)}</Text>
    {stop.stopType === 'overnight' ? (
      <Text style={styles.summaryLine} testID="stop-summary-departure">
        {stop.departsAt
          ? `Leaves ${formatShortDate(stop.departsAt)} at ${formatTime(stop.departsAt)}`
          : 'Leaves the next morning'}
      </Text>
    ) : null}
    {stop.notes ? <Text style={styles.summaryNotes}>{stop.notes}</Text> : null}
  </Screen>
);

type AddStopProps = {
  tripId: number;
  place: Place;
  stopType: NextStopType;
  atPosition?: number;
};

// A new stop's form, opened straight away. The trip loads behind it to work out the day the group
// would get there, which an overnight stay's departure has to come after. Until then, or if it can't
// load, the departure waits and the stop saves without one, leaving the next morning
const AddStop = ({ tripId, place, stopType, atPosition }: AddStopProps) => {
  const { data: arrivalDay } = useAsync(
    async () => {
      const [tripRow, stopRows] = await Promise.all([getTrip(tripId), listTripStops(tripId)]);
      if (!tripRow) return undefined;
      const trip = toTrip(tripRow);
      return newStopArrivalDay(
        stopRows.map(toTripStop),
        trip.tripType,
        trip.startsAt,
        stopType,
        atPosition
      );
    },
    [tripId, stopType, atPosition],
    'StopDetailsScreen.loadArrivalDay'
  );

  return (
    <StopDetailsForm
      tripId={tripId}
      mode={{ kind: 'add', place, stopType, atPosition, arrivalDay: arrivalDay ?? undefined }}
    />
  );
};

type EditStopProps = {
  tripId: number;
  stopId: number;
  newPlace: Place | null;
  renderShell: (title: string, body: ReactNode) => ReactNode;
};

// Loads the stop with what decides how it can be edited: the member's role, and the day the group
// gets there, which is the earliest an overnight departure can be
const EditStop = ({ tripId, stopId, newPlace, renderShell }: EditStopProps) => {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, loading, error } = useAsync(
    async () => {
      const [tripRow, stopRows, memberRows] = await Promise.all([
        getTrip(tripId),
        listTripStops(tripId),
        listTripMembers(tripId),
      ]);
      const stops = stopRows.map(toTripStop);
      const stop = stops.find((candidate) => candidate.id === stopId);
      if (!tripRow || !stop) return null;

      const trip = toTrip(tripRow);
      const arrivalDay = stopArrivalDay(
        itineraryRows(stops, trip.tripType, trip.startsAt, false),
        stopId
      );
      const role = memberRows.map(toTripMember).find((member) => member.id === userId)?.role;

      return { stop, arrivalDay, canEdit: role === 'owner' || role === 'editor' };
    },
    [tripId, stopId, userId],
    'StopDetailsScreen.load'
  );

  if (!data) {
    return renderShell(
      'Stop',
      loading ? (
        <LoadingState testID="stop-details-loading" />
      ) : (
        <EmptyState
          title={error ? "Couldn't load stop" : 'This stop is no longer on the trip'}
          subtitle={error ?? undefined}
        />
      )
    );
  }

  if (!data.canEdit) return renderShell('Stop', <StopSummary stop={data.stop} />);

  return renderShell(
    newPlace ? 'Change Place' : 'Edit Stop',
    <StopDetailsForm
      tripId={tripId}
      mode={{
        kind: 'edit',
        stop: data.stop,
        newPlace,
        arrivalDay: data.arrivalDay,
      }}
    />
  );
};

const StopDetailsScreen = () => {
  const params = useLocalSearchParams<{
    id: string | string[];
    place?: string;
    stopType?: string;
    atPosition?: string;
    stopId?: string;
  }>();
  const tripId = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const place = parsePlaceParam(params.place);
  const stopType = parseNextStopType(params.stopType);
  const stopId = parseStopId(params.stopId);

  const renderShell = (title: string, body: ReactNode) => (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Same as the planner: the gradient only spans the header */}
      <View>
        <LinearGradient
          pointerEvents="none"
          {...gradients.cardToBackground()}
          style={StyleSheet.absoluteFill}
        />
        <ScreenHeader title={title} onBack={() => router.back()} />
      </View>
      {body}
    </View>
  );

  if (stopId !== undefined) {
    return <EditStop tripId={tripId} stopId={stopId} newPlace={place} renderShell={renderShell} />;
  }

  return renderShell(
    addStopLabel(stopType),
    place ? (
      <AddStop
        tripId={tripId}
        place={place}
        stopType={stopType}
        atPosition={parseStopPosition(params.atPosition)}
      />
    ) : (
      <EmptyState title="Couldn't open that place" />
    )
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
  summaryName: {
    color: colors.text,
    fontSize: fontSize.section,
    fontWeight: fontWeight.bold,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  summaryLine: {
    color: colors.text,
    fontSize: fontSize.body,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  summaryNotes: {
    color: colors.textMutedLight,
    fontSize: fontSize.body,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
});
