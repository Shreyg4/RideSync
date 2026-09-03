import SmallButton from '@/src/components/SmallButton';
import { copy } from '@/src/constants/copy';
import { useClientOnlyValue } from '@/src/hooks/useClientOnlyValue';
import Colors from '@/src/constants/colors';
import { fontWeight } from '@/src/constants/typography';
import { radii } from '@/src/constants/radii';
import { gradients } from '@/src/constants/gradients';
import * as Haptics from 'expo-haptics';
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
        backgroundColor: focused ? Colors.tint : 'transparent',
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
          borderColor: Colors.border,
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={[Colors.background, Colors.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1.7 }}
            style={[StyleSheet.absoluteFill, { borderTopWidth: 1, borderColor: Colors.border }]}
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
          <LinearGradient {...gradients.cardToBackground} style={StyleSheet.absoluteFill} />
        ),
        headerTitleAlign: 'left',
        headerTintColor: Colors.text,
        headerTitleStyle: {
          fontSize: 40,
          fontWeight: fontWeight.heavy,
          justifyContent: 'flex-start',
        },
        headerShadowVisible: false,
      }}

      // Haptic feedback for tab bar
      screenListeners={{
        tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      }}
    >
      <Tabs.Screen
        // Home screen of the app where all of the users created/joined trips will show up
        name="trips"
        options={{
          title: copy.tabs.trips,
          // Create-trip FAB
          headerRight: () => (
            <SmallButton
              icon={Plus}
              onPress={() => router.push('/createTrip')}
              style={{ marginRight: 16, marginTop: 5 }}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Route color={focused ? Colors.textOnTint : Colors.textMutedLight} size={ICON_SIZE} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        // Where users will Join someone else's party via join code
        name="joinTrip"
        options={{
          title: copy.tabs.joinTrip,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <User color={focused ? Colors.textOnTint : Colors.textMutedLight} size={ICON_SIZE} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        // User can Archive any trip to use later for themselves or a new group
        name="savedTrips"
        options={{
          title: copy.tabs.savedTrips,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Archive
                color={focused ? Colors.textOnTint : Colors.textMutedLight}
                size={ICON_SIZE}
              />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: copy.tabs.settings,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Settings
                color={focused ? Colors.textOnTint : Colors.textMutedLight}
                size={ICON_SIZE}
              />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}
