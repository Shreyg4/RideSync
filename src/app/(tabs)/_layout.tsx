import { useClientOnlyValue } from '@/src/components/useClientOnlyValue';
import Colors from '@/src/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { Archive, Route, User } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}
function TabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View
      style={{
        width: 130,
        height: 48,
        borderRadius: 32,          // half of width/height = circle
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
        tabBarActiveTintColor: Colors.theme.tint,
        tabBarInactiveTintColor: Colors.theme.textMutedLight,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 35,
          height: 48,
          borderRadius: 32,
          backgroundColor: Colors.theme.card,
          paddingTop: 5
        },
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Journeys',
          headerStyle: [{backgroundColor: Colors.theme.background}, {height: 120}],
          headerTitleAlign: 'left',
          headerTintColor: Colors.theme.text,
          headerTitleStyle: {
            fontSize: 40,
            fontWeight: '800',
            justifyContent: 'flex-start'
          },
          headerShadowVisible: false,
          tabBarIcon: ({ focused, size }) => (
            <TabIcon focused={focused}>
              <Route color={focused ? Colors.theme.textOnTint : Colors.theme.textMutedLight} size={size} />
            </TabIcon>
          )
        }}
      />
      <Tabs.Screen
        name="joinTrip"
        options={{
          title: 'Join Trip',
          tabBarIcon: ({ focused, size }) => (
            <TabIcon focused={focused}>
              <User color={focused ? Colors.theme.textOnTint : Colors.theme.textMutedLight} size={size} />
            </TabIcon>
          )
        }}
      />
      <Tabs.Screen
        name="savedTrips"
        options={{
          title: 'Saved Trips',
          tabBarIcon: ({ focused, size }) => (
            <TabIcon focused={focused}>
              <Archive color={focused ? Colors.theme.textOnTint : Colors.theme.textMutedLight} size={size} />
            </TabIcon>
          )
        }}
      />
    </Tabs>
  );
}
