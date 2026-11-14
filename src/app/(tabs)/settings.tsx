/**
 * @file settings.tsx
 * @description Screen where user can manage their profile preferences and app settings
 */
import { Text, View, StyleSheet, Alert, Switch } from 'react-native';
import LargeButton from '@/src/components/LargeButton';
import ErrorText from '@/src/components/ErrorText';
import Screen from '@/src/components/Screen';
import TopFade from '@/src/components/TopFade';
import { colors, spacing, fontSize, fontWeight } from '@/src/constants/theme';
import { useAuth } from '@/src/context/AuthProvider';
import AvatarImage from '@/src/components/AvatarImage';
import { avatarUrl } from '@/src/services/avatarService';
import { useCallback, useState } from 'react';
import { getUserProfile, setShowFullName } from '@/src/services/userService';
import { reportAndDescribe } from '@/src/services/errors';
import { useAsync } from '@/src/hooks/useAsync';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Chip from '@/src/components/Chip';
import { MAP_STYLES, MAP_STYLE_KEYS, setMapStyle, useMapStyle } from '@/src/lib/mapStyle';

export default function SettingsScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [signOutError, setSignOutError] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const mapStyle = useMapStyle();

  const loadProfile = useCallback(() => getUserProfile(user?.id), [user?.id]);
  const {
    data: profile,
    error: profileError,
    reload: reloadProfile,
  } = useAsync(loadProfile, [user?.id], 'SettingsScreen.getUserProfile');

  // The switch moves straight away and only goes back if saving fails
  const [pickedFullName, setPickedFullName] = useState<boolean>();
  const [nameError, setNameError] = useState<string>();
  const showFullName = pickedFullName ?? profile?.showFullName ?? false;
  const shownName = profile
    ? showFullName
      ? `${profile.firstName} ${profile.lastName}`
      : profile.username
    : undefined;

  const handleShowFullName = async (next: boolean) => {
    if (!user) return;
    const previous = showFullName;
    setNameError(undefined);
    setPickedFullName(next);
    try {
      await setShowFullName(user.id, next);
    } catch (error) {
      setPickedFullName(previous);
      setNameError(reportAndDescribe(error, { scope: 'SettingsScreen.setShowFullName' }));
    }
  };

  const handleSignOut = async () => {
    setSignOutError(undefined);
    try {
      await signOut();
    } catch (error) {
      setSignOutError(reportAndDescribe(error, { scope: 'SettingsScreen.signOut' }));
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(undefined);
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (error) {
      setDeleteError(reportAndDescribe(error, { scope: 'SettingsScreen.deleteAccount' }));
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your profile and saved trips. Trips you own that have other members are handed to one of them; the rest are deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDeleteAccount },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen scroll bottomOffset={tabBarHeight}>
        <AvatarImage
          uri={avatarUrl(profile?.avatarPath)}
          style={styles.avatar}
          testID="settings-avatar"
        />
        {shownName ? (
          <Text style={styles.greeting} testID="settings-greeting">
            Hello, {shownName}
          </Text>
        ) : null}

        <ErrorText
          message={profileError}
          onRetry={reloadProfile}
          retryLabel="Retry"
          style={styles.error}
        />

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Show full name</Text>
            <Text style={styles.toggleHint}>
              Trip members see your name instead of your username
            </Text>
          </View>
          <Switch
            value={showFullName}
            onValueChange={handleShowFullName}
            disabled={!profile}
            trackColor={{ false: colors.border, true: colors.tint }}
            ios_backgroundColor={colors.border}
            accessibilityLabel="Show full name"
            testID="show-full-name-switch"
          />
        </View>
        <ErrorText
          message={nameError}
          onRetry={() => handleShowFullName(!showFullName)}
          style={styles.error}
        />

        <Text style={styles.text}>Map style</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {MAP_STYLE_KEYS.map((key) => (
            <Chip
              key={key}
              label={MAP_STYLES[key].label}
              selected={mapStyle === key}
              onPress={() => setMapStyle(key)}
              testID={`map-style-${key}`}
            />
          ))}
        </View>

        <View style={styles.spacer} />

        <LargeButton
          label="Log Out"
          variant="danger"
          onPress={handleSignOut}
          testID="log-out-button"
        />
        <ErrorText message={signOutError} onRetry={handleSignOut} style={styles.error} />

        <LargeButton
          label="Delete Account"
          variant="danger"
          onPress={confirmDeleteAccount}
          disabled={deleting}
          testID="delete-account-button"
        />
        <ErrorText message={deleteError} onRetry={handleDeleteAccount} style={styles.error} />
      </Screen>
      <TopFade height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  greeting: {
    color: colors.text,
    fontSize: fontSize.section,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  toggleText: {
    flex: 1,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  toggleHint: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginTop: spacing.xxs,
  },
  error: {
    marginLeft: spacing.md,
  },
  text: {
    color: colors.text,
    fontSize: fontSize.section,
    fontWeight: fontWeight.bold,
    marginLeft: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xxl,
  },
});
