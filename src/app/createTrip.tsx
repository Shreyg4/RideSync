import { Platform } from 'react-native';
import React from 'react';
import { spacing } from '@/src/constants/theme';
import { router } from 'expo-router';
import Screen from '@/src/components/Screen';
import ScreenHeader from '@/src/components/ScreenHeader';
import TripForm from '@/src/components/TripForm';
import type { TripFormValues } from '../types/trip';
import { useAuth } from '../context/AuthProvider';
import { createTripWithImage } from '../services/tripCreationService';

const CreateTripScreen = () => {
  const { user } = useAuth();

  const handleCreateTrip = async ({ name, tripType, startsAt, image }: TripFormValues) => {
    if (!user) return 'You need to be signed in to create a trip.';

    await createTripWithImage({
      userId: user.id,
      name,
      tripType,
      startsAt,
      image: image?.kind === 'local' ? { uri: image.uri, mimeType: image.mimeType } : null,
    });
    router.replace('/(tabs)/trips');
  };

  return (
    <Screen scroll gradient bottomOffset={spacing.lg}>
      <ScreenHeader
        title="Create Trip"
        onBack={Platform.OS === 'android' ? () => router.dismiss() : undefined}
        applyTopInset={Platform.OS === 'android'}
        style={{ paddingVertical: spacing.xl }}
      />
      <TripForm
        submitLabel="Create Trip"
        scope="createTrip.handleCreateTrip"
        onSubmit={handleCreateTrip}
      />
    </Screen>
  );
};

export default CreateTripScreen;
