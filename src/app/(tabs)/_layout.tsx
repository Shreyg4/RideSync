import SmallButton from '@/src/components/smallButton';
import { useClientOnlyValue } from '@/src/components/useClientOnlyValue';
import Colors from '@/src/constants/Colors';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, router } from 'expo-router';
import { Archive, Plus, Route, Settings, User } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

//Used to fill the pill behind the icon when tab is slected.
function TabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View
      style={{
        width: 60, //Width of selected pill
        height: 30, //height of selected pill
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? Colors.theme.tint : 'transparent',
      }}>
      {children}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        //Custom tab-bar design
        tabBarStyle: {
          position: 'absolute',
          height: 95,
          borderRadius: 24,
          borderTopWidth: 0,
          borderColor: Colors.theme.border,
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={[Colors.theme.background, Colors.theme.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1.7 }}
            style={[StyleSheet.absoluteFill, {borderTopWidth: 1, borderColor: Colors.theme.border}]}
          />
        ),
        tabBarLabelStyle: {
          marginTop: 4,
        },

        //Header style for all tabs
        headerShown: useClientOnlyValue(false, true),
        headerStyle: [{height: 130}],
        //Gradient sits behind the title/buttons. end y:0.5 means it fades from card->background over the top half.
        headerBackground: () => (
          <LinearGradient
            colors={[Colors.theme.card, Colors.theme.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 0.7 }}
            style={StyleSheet.absoluteFill}
          />
        ),
        headerTitleAlign: 'left',
        headerTintColor: Colors.theme.text,
        headerTitleStyle: {
          fontSize: 40,
          fontWeight: '800',
          justifyContent: 'flex-start',
        },
        headerShadowVisible: false,
      }}

      //Haptic feedback for tab bar
      screenListeners={{
        tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      }}>

      <Tabs.Screen
        //Home screen of the app where all of the users created/joined trips will show up
        name="index"
        options={{
          title: 'Journeys',
          //Create-trip FAB 
          headerRight: () => (
            <SmallButton icon={Plus} onPress={() => router.push('/modal')} style={{ marginRight: 16, marginTop: 5 }} />
          ),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Route color={focused ? Colors.theme.textOnTint : Colors.theme.textMutedLight} size={20} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        //Where users will Join someone else's party via join code
        name="joinTrip"
        options={{
          title: 'Join Trip',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <User color={focused ? Colors.theme.textOnTint : Colors.theme.textMutedLight} size={20} />
            </TabIcon>
          )
        }}
      />
      <Tabs.Screen
        //User can Archive any trip to use later for themselves or a new group
        name="savedTrips"
        options={{
          title: 'Saved Trips',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Archive color={focused ? Colors.theme.textOnTint : Colors.theme.textMutedLight} size={20} />
            </TabIcon>
          )
        }}
      />
      <Tabs.Screen
        //User can Archive any trip to use later for themselves or a new group
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Settings color={focused ? Colors.theme.textOnTint : Colors.theme.textMutedLight} size={20} />
            </TabIcon>
          )
        }}
      />
    </Tabs>
  );
}
