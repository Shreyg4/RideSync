import { Text, View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LargeButton from '@/src/components/largeButton';
import Colors from '@/src/constants/colors';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/context/AuthProvider';
import AvatarImage from '@/src/components/avatarImage';
import { avatarUrl } from '@/src/services/avatarService';
import { useCallback, useState } from 'react';
import { getUserAvatarPath } from '@/src/services/userService';
import { reportAndDescribe } from '@/src/services/errors';
import { useAsync } from '@/src/hooks/useAsync';

const SmallTextButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} accessibilityRole="button">
    <Text style={styles.retryText}>{label}</Text>
  </Pressable>
);

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string>();

  const loadAvatarPath = useCallback(() => getUserAvatarPath(user?.id), [user?.id]);
  const {
    data: photoPath,
    error: avatarError,
    reload: reloadAvatar,
  } = useAsync(loadAvatarPath, [user?.id], 'Settings.getUserAvatarPath');

  const handleSignOut = async () => {
    setSignOutError(undefined);
    try {
      await signOut();
    } catch (error) {
      setSignOutError(reportAndDescribe(error, { scope: 'Settings.signOut' }));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 75 }}
      >
        <View>
          <AvatarImage
            uri={avatarUrl(photoPath)}
            style={{ alignSelf: 'center', marginVertical: 20 }}
          />
          {avatarError ? (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{avatarError}</Text>
              <SmallTextButton label="Retry" onPress={reloadAvatar} />
            </View>
          ) : null}
          <Text style={styles.text}>Settings that will come soon</Text>
          <LargeButton
            label="Delete Account"
            onPress={() => router.back()}
            color="red"
            backgroundColor={Colors.theme.border}
            backgroundColorPressed={Colors.theme.card}
          />
          <LargeButton
            label="Log Out"
            onPress={handleSignOut}
            color="red"
            backgroundColor={Colors.theme.border}
            backgroundColorPressed={Colors.theme.card}
          />
          {signOutError ? (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{signOutError}</Text>
              <SmallTextButton label="Try again" onPress={handleSignOut} />
            </View>
          ) : null}
        </View>
      </ScrollView>
      {/* Gradient header overlay: solid at the top, fading to transparent at the bottom */}
      <LinearGradient
        colors={[Colors.theme.background, Colors.theme.background, 'transparent']}
        locations={[0, 0, 1]}
        style={[styles.header]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 15,
    marginBottom: 8,
  },
  errorText: {
    color: Colors.theme.error,
    fontSize: 15,
  },
  retryText: {
    color: Colors.theme.tint,
    fontSize: 15,
    fontWeight: '600',
  },
  text: {
    color: Colors.theme.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: '140%',
  },
});
