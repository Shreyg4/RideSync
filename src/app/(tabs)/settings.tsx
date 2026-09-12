import { Text, View, StyleSheet } from 'react-native';
import LargeButton from '@/src/components/LargeButton';
import ErrorText from '@/src/components/ErrorText';
import Screen from '@/src/components/Screen';
import TopFade from '@/src/components/TopFade';
import { colors, spacing, fontSize, fontWeight } from '@/src/constants/theme'
import { router } from 'expo-router';
import { useAuth } from '@/src/context/AuthProvider';
import AvatarImage from '@/src/components/AvatarImage';
import { avatarUrl } from '@/src/services/avatarService';
import { useCallback, useState } from 'react';
import { getUserAvatarPath } from '@/src/services/userService';
import { reportAndDescribe } from '@/src/services/errors';
import { useAsync } from '@/src/hooks/useAsync';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [signOutError, setSignOutError] = useState<string>();

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

        <Text style={styles.text}>Settings that will come soon</Text>

        <View style={styles.spacer} />

        <LargeButton
          label="Delete Account"
          variant="danger"
          onPress={() => router.back()}
          testID="delete-account-button"
        />
        <LargeButton
          label="Log Out"
          variant="danger"
          onPress={handleSignOut}
          testID="log-out-button"
        />
        <ErrorText message={signOutError} onRetry={handleSignOut} style={styles.error} />
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
