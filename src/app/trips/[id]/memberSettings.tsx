/**
 * @file memberSettings.tsx
 * @description Who is on a trip and what they can do. The owner gives editor access, removes members,
 * hands over ownership, and cancels or deletes the trip. Anyone can leave
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AvatarImage from '@/src/components/AvatarImage';
import EmptyState from '@/src/components/EmptyState';
import ErrorText from '@/src/components/ErrorText';
import LargeButton from '@/src/components/LargeButton';
import LoadingState from '@/src/components/LoadingState';
import ScreenHeader from '@/src/components/ScreenHeader';
import { colors, fontSize, fontWeight, gradients, radii, spacing } from '@/src/constants/theme';
import { useAuth } from '@/src/context/AuthProvider';
import { memberRoleLabel, nextOwner } from '@/src/domain/rules';
import { useAsync } from '@/src/hooks/useAsync';
import { toTripMember } from '@/src/lib/tripMapper';
import { reportAndDescribe } from '@/src/services/errors';
import {
  cancelTrip,
  deleteTrip,
  leaveTrip,
  listTripMembers,
  removeTripMember,
  setMemberRole,
  transferTripOwnership,
} from '@/src/services/tripService';
import type { TripMember } from '@/src/types/trip';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';

const AVATAR_SIZE = 44;

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

const MemberSettingsScreen = () => {
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
    'MemberSettingsScreen.listTripMembers'
  );

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const isOwner = !!members?.some((member) => member.id === user?.id && member.role === 'owner');

  // Member changes reload the list; leaving, cancelling and deleting end on the Trips tab instead
  const run = async (scope: string, action: () => Promise<void>, onDone: () => void = reload) => {
    setActionError(undefined);
    setBusy(true);
    try {
      await action();
      onDone();
    } catch (caught) {
      setActionError(reportAndDescribe(caught, { scope: `MemberSettingsScreen.${scope}` }));
    } finally {
      setBusy(false);
    }
  };

  const exitTrip = () => router.dismissTo('/trips');

  const toggleEditor = (member: TripMember, editor: boolean) =>
    run('setMemberRole', () => setMemberRole(tripId, member.id, editor ? 'editor' : 'viewer'));

  const confirmRemove = (member: TripMember) =>
    confirmAction(
      `Remove ${member.name}?`,
      'They lose access right away, but can rejoin with the join code.',
      'Remove',
      () => run('removeTripMember', () => removeTripMember(tripId, member.id))
    );

  const confirmMakeOwner = (member: TripMember) =>
    confirmAction(
      `Make ${member.name} the owner?`,
      "You'll stay on the trip as an editor, and only they can give ownership back.",
      'Make Owner',
      () => run('transferTripOwnership', () => transferTripOwnership(tripId, member.id))
    );

  const manageMember = (member: TripMember) =>
    Alert.alert(
      member.name,
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => confirmRemove(member) },
        { text: 'Make Owner', onPress: () => confirmMakeOwner(member) },
      ],
      { cancelable: true }
    );

  const confirmLeave = () => {
    const successor = nextOwner(members ?? []);
    const message = !isOwner
      ? "You'll need the join code to get back in."
      : successor
        ? `${successor.name} becomes the owner.`
        : "You're the only member, so the trip will be deleted.";
    confirmAction('Leave trip?', message, 'Leave', () =>
      run('leaveTrip', () => leaveTrip(tripId), exitTrip)
    );
  };

  const confirmCancel = () =>
    confirmAction(
      'Cancel trip?',
      'The trip ends for everyone. Each member keeps a copy in Saved Trips to reuse later.',
      'Cancel Trip',
      () => run('cancelTrip', () => cancelTrip(tripId), exitTrip),
      'Keep Trip'
    );

  const confirmDelete = () =>
    confirmAction(
      'Delete trip?',
      'The trip is permanently deleted for everyone. Nobody keeps a copy.',
      'Delete',
      () => run('deleteTrip', () => deleteTrip(tripId), exitTrip)
    );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        pointerEvents="none"
        {...gradients.cardToBackground(0.2)}
        style={StyleSheet.absoluteFill}
      />
      <ScreenHeader title="Member Settings" onBack={() => router.back()} />

      {!members ? (
        loading ? (
          <LoadingState testID="member-settings-loading" />
        ) : (
          <EmptyState title="Couldn't load members" subtitle={error ?? undefined} />
        )
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.sm }}
        >
          <View style={styles.card} testID="member-settings-list">
            <Text style={styles.subHeading}>Members</Text>
            {isOwner ? (
              <Text style={styles.hint}>Editors can change the itinerary and trip details.</Text>
            ) : null}
            {members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isSelf={member.id === user?.id}
                canManage={isOwner && member.role !== 'owner'}
                disabled={busy}
                onToggleEditor={(editor) => toggleEditor(member, editor)}
                onManage={() => manageMember(member)}
              />
            ))}
          </View>

          <ErrorText message={actionError} style={styles.error} testID="member-settings-error" />

          <LargeButton
            label="Leave Trip"
            variant="danger"
            onPress={confirmLeave}
            disabled={busy}
            testID="leave-trip-button"
          />
          {isOwner ? (
            <>
              <LargeButton
                label="Cancel Trip"
                variant="danger"
                onPress={confirmCancel}
                disabled={busy}
                testID="cancel-trip-button"
              />
              <LargeButton
                label="Delete Trip"
                variant="danger"
                onPress={confirmDelete}
                disabled={busy}
                testID="delete-trip-button"
              />
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
};

export default MemberSettingsScreen;

type MemberRowProps = {
  member: TripMember;
  isSelf: boolean;
  canManage: boolean;
  disabled: boolean;
  onToggleEditor: (editor: boolean) => void;
  onManage: () => void;
};

function MemberRow({
  member,
  isSelf,
  canManage,
  disabled,
  onToggleEditor,
  onManage,
}: MemberRowProps) {
  const details = (
    <>
      <AvatarImage
        uri={member.avatar}
        size={AVATAR_SIZE}
        accessibilityLabel={`${member.name}'s profile picture`}
      />
      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={1}>
          {isSelf ? `${member.name} (you)` : member.name}
        </Text>
        <Text style={styles.role}>{memberRoleLabel(member.role)}</Text>
      </View>
    </>
  );

  if (!canManage) {
    return (
      <View style={styles.row}>
        <View style={styles.details}>{details}</View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {/* The switch sits beside the Pressable, not inside it, so toggling it doesn't also open the menu */}
      <Pressable
        onPress={() => {
          haptics.selection();
          onManage();
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Manage ${member.name}`}
        accessibilityHint="Remove them or make them the owner"
        style={({ pressed }) => [styles.details, pressFeedback.control(pressed)]}
      >
        {details}
      </Pressable>
      <Switch
        value={member.role === 'editor'}
        onValueChange={onToggleEditor}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.tint }}
        ios_backgroundColor={colors.border}
        accessibilityLabel={`Editor access for ${member.name}`}
        style={Platform.select({ ios: { marginTop: 7 }, default: {} })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    margin: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
  },
  subHeading: {
    color: colors.text,
    fontSize: fontSize.section,
    fontWeight: fontWeight.heavy,
    marginBottom: spacing.xxs,
  },
  hint: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  identity: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  role: {
    color: colors.tintSubtle,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
  },
  error: {
    marginHorizontal: spacing.md,
  },
  details: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
