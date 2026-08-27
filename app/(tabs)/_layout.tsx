import React from 'react';
import { Tabs } from 'expo-router';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { palette } from '@/components/modelcommons/HubUI';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: { borderTopColor: palette.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <IconSymbol size={23} name="house.fill" color={color} /> }} />
      <Tabs.Screen name="models" options={{ title: 'Models', tabBarIcon: ({ color }) => <IconSymbol size={23} name="shippingbox.fill" color={color} /> }} />
      <Tabs.Screen name="device" options={{ title: 'Device', tabBarIcon: ({ color }) => <IconSymbol size={23} name="cpu.fill" color={color} /> }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarIcon: ({ color }) => <IconSymbol size={23} name="person.2.fill" color={color} /> }} />
      <Tabs.Screen name="compatibility" options={{ title: 'APIs', tabBarIcon: ({ color }) => <IconSymbol size={23} name="point.3.connected.trianglepath.dotted" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <IconSymbol size={23} name="gearshape.fill" color={color} /> }} />
    </Tabs>
  );
}
