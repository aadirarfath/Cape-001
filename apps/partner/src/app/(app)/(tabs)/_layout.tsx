import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { m } from '@/i18n';
import { useSession } from '@/lib/session';
import { font, useColors } from '@/theme';

export default function TabsLayout() {
  const { isManager, shop } = useSession();
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerTitleStyle: { fontSize: font.large },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
        tabBarStyle: { height: 72, paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: shop?.name ?? m.schedule.title,
          tabBarLabel: m.tabs.schedule,
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={28} color={color} />,
        }}
      />
      <Tabs.Protected guard={isManager}>
        <Tabs.Screen
          name="shop"
          options={{
            title: m.manage.title,
            tabBarLabel: m.tabs.shop,
            tabBarIcon: ({ color }) => <Ionicons name="storefront" size={28} color={color} />,
          }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="me"
        options={{
          title: m.me.title,
          tabBarLabel: m.tabs.me,
          tabBarIcon: ({ color }) => <Ionicons name="person-circle" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
