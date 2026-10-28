import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Alert, ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tripImageSource } from '@/src/constants/tripImage';
import { colors, spacing, fontSize, fontWeight, radii } from '@/src/constants/theme';
import SmallButton from '@/src/components/SmallButton';
import { ChevronLeft } from 'lucide-react-native';
import LargeButton from '@/src/components/LargeButton';
import LoadingState from '@/src/components/LoadingState';
import EmptyState from '@/src/components/EmptyState';
import { useAsync } from '@/src/hooks/useAsync';
import { deleteSavedTrip, getSavedTrip } from '@/src/services/tripService';
import { toSavedTrip } from '@/src/lib/tripMapper';
import { tripTypeLabel } from '@/src/domain/rules';
import { reportAndDescribe } from '@/src/services/errors';
import { useState } from 'react';
import ErrorText from '@/src/components/ErrorText';

const confirmAction = (
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  dismissLabel = 'Cancel'
) =>
  Alert.alert(title, message, [
    { text: dismissLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);

const SavedTripDetailsScreen = () => {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const tripId = Number(Array.isArray(id) ? id[0] : id);

  const {
    data: row,
    loading,
    error,
    reload,
  } = useAsync(
    () => (Number.isInteger(tripId) ? getSavedTrip(tripId) : Promise.resolve(null)),
    [tripId],
    'SavedTripDetailsScreen.savedTrip'
  );

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const run = async (scope: string, action: () => Promise<void>, onDone: () => void = reload) => {
    setActionError(undefined);
    setBusy(true);
    try {
      await action();
      onDone();
    } catch (caught) {
      setActionError(reportAndDescribe(caught, { scope: `SavedTripDetailsScreen.${scope}` }));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeletion = () => {
    confirmAction(
      'Delete Trip?',
      'This trip will be permanently deleted for you',
      'Delete Trip',
      () =>
        run(
          'deleteTrip',
          () => deleteSavedTrip(tripId),
          () => router.dismissTo('/savedTrips')
        ),
      'Keep trip'
    );
  };

  const backButton = (
    <SmallButton
      icon={ChevronLeft}
      onPress={() => router.back()}
      accessibilityLabel="Go back"
      style={{ position: 'absolute', left: 15, top: insets.top, zIndex: 10 }}
    />
  );

  if (loading || !row) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        {loading ? (
          <LoadingState testID="trip-details-loading" />
        ) : (
          <EmptyState
            title={error ? "Couldn't load trip" : 'Trip not found'}
            subtitle={error ?? undefined}
          />
        )}
        {backButton}
      </View>
    );
  }

  const trip = toSavedTrip(row);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        <ImageBackground
          source={tripImageSource(trip.image)}
          style={[styles.image, { paddingTop: insets.top }]}
        >
          {/* Bottom scrim: keeps the title readable; scrolls away with the image */}
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'transparent', 'rgba(0, 0, 0, 1)']}
            locations={[0, 0.7, 0.85]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.title}>{trip.name}</Text>
        </ImageBackground>

        {/* Type is listed here for a saved trip */}
        <View style={styles.subContainerInfo}>
          <Text style={[styles.infoText, styles.centerText]} numberOfLines={1} adjustsFontSizeToFit>
            {tripTypeLabel(trip.tripType)}
          </Text>
        </View>

        {/* Where itinerary will be listed */}
        <View style={styles.subContainer}>
          <Text style={styles.subHeading}>Itinerary</Text>
          <Text style={[styles.text, { paddingBottom: spacing.lg }]}>Not planned</Text>
        </View>

        <ErrorText message={actionError} style={styles.error} testID="saved-trip-error" />
        {/* The Directions Button */}
        <LargeButton label="Directions" onPress={() => router.back()} />
        {/* The create trip Button */}
        <LargeButton
          label="Re-create Trip"
          onPress={() =>
            router.push({ pathname: '/createTrip', params: { savedTripId: String(tripId) } })
          }
        />
        <LargeButton
          label="Delete Trip"
          variant="danger"
          onPress={confirmDeletion}
          disabled={busy}
          testID="delete-trip-button"
        />
      </ScrollView>

      {/* Fixed top gradient so that status bar is always easy to see */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0, 0, 0, 1)', 'transparent']}
        locations={[0, 0.15]}
        style={StyleSheet.absoluteFill}
      />
      {backButton}
    </View>
  );
};

export default SavedTripDetailsScreen;

const styles = StyleSheet.create({
  image: {
    width: '100%',
    aspectRatio: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.screenTitle,
    fontWeight: fontWeight.heavy,
    marginTop: 'auto',
    textAlign: 'center',
  },
  subContainer: {
    margin: 10,
    padding: 20,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
  },
  subContainerInfo: {
    margin: 20,
  },
  subHeading: {
    color: colors.text,
    fontSize: fontSize.sheetTitle,
    fontWeight: fontWeight.heavy,
    marginBottom: 10,
  },
  centerText: {
    textAlign: 'center',
    marginBottom: 10,
  },
  infoText: {
    color: colors.tint,
    fontSize: fontSize.sheetTitle,
    fontWeight: fontWeight.heavy,
  },
  text: {
    color: colors.tintSubtle,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
  },
  error: {
    marginHorizontal: spacing.md,
  },
});
