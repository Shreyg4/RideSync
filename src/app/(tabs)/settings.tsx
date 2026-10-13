/**
 * @file settings.tsx
 * @description Screen where user can manage their profile preferences and app settings
 */
import { Text, View, StyleSheet, Alert } from 'react-native';
import LargeButton from '@/src/components/LargeButton';
import ErrorText from '@/src/components/ErrorText';
import Screen from '@/src/components/Screen';
import TopFade from '@/src/components/TopFade';
import { colors, spacing, fontSize, fontWeight } from '@/src/constants/theme';
import { useAuth } from '@/src/context/AuthProvider';
import AvatarImage from '@/src/components/AvatarImage';
import { avatarUrl } from '@/src/services/avatarService';
import { useCallback, useState } from 'react';
import { getUserAvatarPath } from '@/src/services/userService';
import { reportAndDescribe } from '@/src/services/errors';
import { useAsync } from '@/src/hooks/useAsync';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

export default function SettingsScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [signOutError, setSignOutError] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  const loadAvatarPath = useCallback(() => getUserAvatarPath(user?.id), [user?.id]);
  const {
    data: photoPath,
    error: avatarError,
    reload: reloadAvatar,
  } = useAsync(loadAvatarPath, [user?.id], 'SettingsScreen.getUserAvatarPath');

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
        <AvatarImage uri={avatarUrl(photoPath)} style={styles.avatar} testID="settings-avatar" />

        <ErrorText
          message={avatarError}
          onRetry={reloadAvatar}
          retryLabel="Retry"
          style={styles.error}
        />

        <Text style={styles.text}>Settings coming soon</Text>

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
    marginVertical: spacing.lg,
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
  spacer: {
    flex: 1,
    minHeight: spacing.xxl,
  },
});
