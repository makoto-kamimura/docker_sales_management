import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'ホーム', tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: '検索', tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} /> }} />
      <Tabs.Screen name="cart" options={{ title: 'カート', tabBarIcon: ({ color }) => <TabBarIcon name="shopping-cart" color={color} /> }} />
      <Tabs.Screen name="subscriptions" options={{ title: 'サブスク', tabBarIcon: ({ color }) => <TabBarIcon name="refresh" color={color} /> }} />
      <Tabs.Screen name="chat" options={{ title: 'AI接客', tabBarIcon: ({ color }) => <TabBarIcon name="comments" color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: 'アカウント', tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} /> }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
