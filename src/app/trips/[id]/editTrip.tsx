/**
 * @file editTrip.tsx
 * @description Allows user to change the trip name, date,
 * time, and image on a created trip
 */
import ScreenHeader from '@/src/components/ScreenHeader';
import TripForm from '@/src/components/TripForm';
import { useAuth } from '@/src/context/AuthProvider';
import { useAsync } from '@/src/hooks/useAsync';
import { updateTripWithImage } from '@/src/services/tripCreationService';
import { getTrip, listTripMembers } from '@/src/services/tripService';
import { TripFormValues, TripType } from '@/src/types/trip';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import Screen from '@/src/components/Screen';
import { colors, gradients, spacing } from '@/src/constants/theme';
import LoadingState from '@/src/components/LoadingState';
import EmptyState from '@/src/components/EmptyState';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const EditTripScreen = () => {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const tripId = Number(Array.isArray(id) ? id[0] : id);

  const { data, loading, error } = useAsync(
    async () => {
      if (!Number.isInteger(tripId)) return null;
      const [trip, members] = await Promise.all([getTrip(tripId), listTripMembers(tripId)]);
      return trip ? { trip, role: members.find((m) => m.user_id === user?.id)?.role } : null;
    },
    [tripId, user?.id],
    'EditTripScreen.load'
  );

  const status = (content: React.ReactNode) => (
    <Screen gradient scroll={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Edit Trip" onBack={() => router.back()} />
      {content}
    </Screen>
  );

  if (!data) {
    return status(
      loading ? (
        <LoadingState testID="edit-trip-loading" />
      ) : (
        <EmptyState
          title={error ? "Couldn't load trip" : 'Trip not found'}
          subtitle={error ?? undefined}
        />
      )
    );
  }

  if (data.role !== 'owner' && data.role !== 'editor') {
    return status(<EmptyState title="Only the owner and editors can edit this trip" />);
  }

  const { trip } = data;

  const handleSave = async (values: TripFormValues) => {
    if (!user) return 'You need to be signed in to edit a trip.';
    await updateTripWithImage(user.id, trip, values);
    router.back();
  };
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        pointerEvents="none"
        {...gradients.cardToBackground(0.2)}
        style={StyleSheet.absoluteFill}
      />
      <ScreenHeader
        title="Edit Trip"
        onBack={() => router.back()}
        style={{ marginBottom: spacing.lg }}
      />
      <TripForm
        initialValues={{
          name: trip.name,
          tripType: trip.trip_type as TripType,
          startsAt: new Date(trip.starts_at),
          image: trip.image_url ? { kind: 'stored', path: trip.image_url } : null,
        }}
        submitLabel="Save Changes"
        scope="EditTripScreen.handleSave"
        onSubmit={handleSave}
      />
    </View>
  );
};

export default EditTripScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
});
