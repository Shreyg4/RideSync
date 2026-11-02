import { Platform } from 'react-native';
import React from 'react';
import { spacing } from '@/src/constants/theme';
import { router, useLocalSearchParams } from 'expo-router';
import Screen from '@/src/components/Screen';
import ScreenHeader from '@/src/components/ScreenHeader';
import TripForm from '@/src/components/TripForm';
import LoadingState from '@/src/components/LoadingState';
import EmptyState from '@/src/components/EmptyState';
import type { TripFormValues, TripType } from '../types/trip';
import { useAuth } from '../context/AuthProvider';
import { useAsync } from '../hooks/useAsync';
import { createTripWithImage } from '../services/tripCreationService';
import { getSavedTrip } from '../services/tripService';

const CreateTripScreen = () => {
  const { user } = useAuth();
  // Set when opened from a saved trip's Re-create button
  const { savedTripId } = useLocalSearchParams<{ savedTripId?: string | string[] }>();
  const savedId = Array.isArray(savedTripId) ? savedTripId[0] : savedTripId;
  const recreating = savedId !== undefined;

  const {
    data: saved,
    loading,
    error,
  } = useAsync(
    () => {
      const id = Number(savedId);
      return recreating && Number.isInteger(id) ? getSavedTrip(id) : Promise.resolve(null);
    },
    [savedId],
    'CreateTripScreen.savedTrip'
  );

  const title = recreating ? 'Re-create Trip' : 'Create Trip';

  const handleCreateTrip = async ({ name, tripType, startsAt, image }: TripFormValues) => {
    if (!user) return 'You need to be signed in to create a trip.';

    await createTripWithImage({ userId: user.id, name, tripType, startsAt, image });
    router.replace('/(tabs)/trips');
  };

  return (
    <Screen scroll gradient bottomOffset={spacing.lg}>
      <ScreenHeader
        title={title}
        onBack={Platform.OS === 'android' ? () => router.dismiss() : undefined}
        applyTopInset={Platform.OS === 'android'}
        style={{ paddingVertical: spacing.xl }}
      />
      {/* TripForm only reads initialValues on mount, so wait for the saved trip first */}
      {recreating && !saved ? (
        loading ? (
          <LoadingState testID="create-trip-loading" />
        ) : (
          <EmptyState
            title={error ? "Couldn't load trip" : 'Trip not found'}
            subtitle={error ?? undefined}
          />
        )
      ) : (
        <TripForm
          initialValues={
            saved
              ? {
                  name: saved.name,
                  tripType: saved.trip_type as TripType,
                  image: saved.image_url ? { kind: 'stored', path: saved.image_url } : null,
                }
              : undefined
          }
          submitLabel={title}
          scope="createTrip.handleCreateTrip"
          onSubmit={handleCreateTrip}
        />
      )}
    </Screen>
  );
};

export default CreateTripScreen;
