import SmallButton from '@/src/components/SmallButton';
import { useClientOnlyValue } from '@/src/hooks/useClientOnlyValue';
import { colors, fontWeight, radii, gradients } from '@/src/constants/theme'
import { haptics } from '@/src/constants/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, router } from 'expo-router';
import { Archive, Plus, Route, Settings, User } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Icon size of icons in tab bar
const ICON_SIZE = 20;

// Used to fill the pill behind the icon when tab is selected.
function TabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View
      style={{
        width: 60, // Width of selected pill
        height: 30, // height of selected pill
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.tint : 'transparent',
        pointerEvents: 'none',
      }}
    >
      {children}
    </View>
  );
}

export default function TabLayout() {
  // Bottom inset = Android system nav bar / iPhone home indicator height
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      initialRouteName="trips"
      screenOptions={{
        // Custom tab-bar design
        tabBarStyle: {
          position: 'absolute',
          height: 60 + insets.bottom,
          borderRadius: radii.xl,
          borderTopWidth: 0,
          borderColor: colors.border,
        },
        tabBarBackground: () => (
          <LinearGradient
            pointerEvents="none"
            colors={[colors.background, colors.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1.7 }}
            style={[StyleSheet.absoluteFill, { borderTopWidth: 1, borderColor: colors.border }]}
          />
        ),
        tabBarLabelStyle: {
          marginTop: 4,
        },

        // Header style for all tabs
        headerShown: useClientOnlyValue(false, true),
        headerStyle: [{ height: 130 }],
        // Gradient sits behind the title/buttons. end y:0.5 means it fades from card->background over the top half.
        headerBackground: () => (
          <LinearGradient
            pointerEvents="none"
            {...gradients.cardToBackground}
            style={StyleSheet.absoluteFill}
          />
        ),
        headerTitleAlign: 'left',
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontSize: 40,
          fontWeight: fontWeight.heavy,
          justifyContent: 'flex-start',
        },
        headerShadowVisible: false,
      }}

      // Haptic feedback for tab bar
      screenListeners={{
        tabPress: () => haptics.action,
      }}
    >
      <Tabs.Screen
        // Home screen of the app where all of the users created/joined trips will show up
        name="trips"
        options={{
          title: 'Trips',
          // Create-trip FAB
          headerRight: () => (
            <SmallButton
              icon={Plus}
              onPress={() => router.push('/createTrip')}
              accessibilityLabel="Create a trip"
              style={{ marginRight: 16, marginTop: 5 }}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Route color={focused ? colors.textOnTint : colors.textMutedLight} size={ICON_SIZE} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        // Where users will Join someone else's party via join code
        name="joinTrip"
        options={{
          title: 'Join Trip',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <User color={focused ? colors.textOnTint : colors.textMutedLight} size={ICON_SIZE} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        // User can Archive any trip to use later for themselves or a new group
        name="savedTrips"
        options={{
          title: 'Saved Trips',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Archive
                color={focused ? colors.textOnTint : colors.textMutedLight}
                size={ICON_SIZE}
              />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Settings
                color={focused ? colors.textOnTint : colors.textMutedLight}
                size={ICON_SIZE}
              />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}
