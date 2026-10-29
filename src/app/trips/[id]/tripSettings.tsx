/**
 * @file tripSettings.tsx
 * @description The menu for a trip's settings. Each row opens its own screen; leaving and
 * cancelling the trip sit at the bottom since they act on the whole trip
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import ScreenHeader from '@/src/components/ScreenHeader';
import { colors, gradients, spacing } from '@/src/constants/theme';
import { useAuth } from '@/src/context/AuthProvider';
import { nextOwner } from '@/src/domain/rules';
import { useAsync } from '@/src/hooks/useAsync';
import { toTripMember } from '@/src/lib/tripMapper';
import { reportAndDescribe } from '@/src/services/errors';
import { cancelTrip, leaveTrip, listTripMembers } from '@/src/services/tripService';
import SettingsRow from '@/src/components/SettingsRow';
import { Pencil, Users } from 'lucide-react-native';
import LargeButton from '@/src/components/LargeButton';
import ErrorText from '@/src/components/ErrorText';
import LoadingState from '@/src/components/LoadingState';
import EmptyState from '@/src/components/EmptyState';
import TopFade from '@/src/components/TopFade';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const TripSettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const tripId = Number(Array.isArray(id) ? id[0] : id);

  const {
    data: members,
    loading,
    error,
    reload,
  } = useAsync(
    async () => (Number.isInteger(tripId) ? (await listTripMembers(tripId)).map(toTripMember) : []),
    [tripId],
    'TripSettingsScreen.listTripMembers'
  );

  // Roles can change on the members screen (handing over ownership), so reload on the way back
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
    }, [reload])
  );

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const myRole = members?.find((member) => member.id === user?.id)?.role;
  const isOwner = myRole === 'owner';
  const canEdit = myRole === 'owner' || myRole === 'editor';

  // Leaving and cancelling both end on the Trips tab
  const run = async (scope: string, action: () => Promise<void>) => {
    setActionError(undefined);
    setBusy(true);
    try {
      await action();
      router.dismissTo('/trips');
    } catch (caught) {
      setActionError(reportAndDescribe(caught, { scope: `TripSettingsScreen.${scope}` }));
    } finally {
      setBusy(false);
    }
  };

  const confirmLeave = () => {
    const successor = nextOwner(members ?? []);
    const message = !isOwner
      ? "You'll need the join code to get back in."
      : successor
        ? `${successor.name} becomes the owner.`
        : "You're the only member, so the trip will be deleted.";
    confirmAction('Leave trip?', message, 'Leave', () => run('leaveTrip', () => leaveTrip(tripId)));
  };

  const confirmCancel = () =>
    confirmAction(
      'Cancel trip?',
      'The trip ends for everyone. Each member keeps a copy in Saved Trips to reuse later.',
      'Cancel Trip',
      () => run('cancelTrip', () => cancelTrip(tripId)),
      'Keep Trip'
    );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View>
        <LinearGradient
          pointerEvents="none"
          {...gradients.cardToBackground(0.2)}
          style={StyleSheet.absoluteFill}
        />
        <ScreenHeader title="Trip Settings" onBack={() => router.back()} />
      </View>
      {/* The role decides which rows and buttons show, so nothing renders until it is known */}
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {!members ? (
          loading ? (
            <LoadingState testID="trip-settings-loading" />
          ) : (
            <EmptyState title="Couldn't load trip settings" subtitle={error ?? undefined} />
          )
        ) : (
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing.sm }}
              testID="trip-settings-list"
            >
              <SettingsRow
                icon={Users}
                settingName="Manage members"
                settingHint="Manage members on this trip"
                onPress={() => router.push(`/trips/${tripId}/memberSettings`)}
                testID="members-row"
              />
              {canEdit ? (
                <SettingsRow
                  icon={Pencil}
                  settingName="Edit Trip"
                  settingHint="Change trip information"
                  onPress={() => router.push(`/trips/${tripId}/editTrip`)}
                  testID="edit-trip-row"
                />
              ) : null}
              {/* <SettingsRow
              icon={Settings2}
              settingName="Trip Preferences"
              settingHint="Set preferences for trip"
              onPress={() => router.push(`/trips/${tripId}/memberSettings`)}
            /> */}
            </ScrollView>

            <ErrorText message={actionError} style={styles.error} testID="trip-settings-error" />

            <LargeButton
              label="Leave Trip"
              variant="danger"
              onPress={confirmLeave}
              disabled={busy}
              testID="leave-trip-button"
            />
            {isOwner ? (
              <LargeButton
                label="Cancel Trip"
                variant="danger"
                onPress={confirmCancel}
                disabled={busy}
                testID="cancel-trip-button"
              />
            ) : null}
          </>
        )}
        <TopFade height={12} />
      </View>
    </View>
  );
};

export default TripSettingsScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  error: {
    marginHorizontal: spacing.md,
  },
});
