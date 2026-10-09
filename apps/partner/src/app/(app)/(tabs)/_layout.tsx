import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { m } from '@/i18n';
import { useSession } from '@/lib/session';
import { Grain } from '@/components/ui';
import { fonts, useColors } from '@/theme';

export default function TabsLayout() {
  const { isManager, shop } = useSession();
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerTitleStyle: { fontSize: 17, fontFamily: fonts.display, color: colors.text },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        // Black textured bar: the one solid block of ink in the app.
        tabBarActiveTintColor: colors.chromeText,
        tabBarInactiveTintColor: colors.chromeMuted,
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.display, letterSpacing: 0.8, textTransform: 'uppercase' },
        tabBarStyle: { height: 76, paddingTop: 8, borderTopWidth: 0, backgroundColor: colors.chrome },
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: colors.chrome }}>
            <Grain tone="onDark" />
          </View>
        ),
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: shop?.name ?? m.schedule.title,
          tabBarLabel: m.tabs.schedule,
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={26} color={color} />,
        }}
      />
      <Tabs.Protected guard={isManager}>
        <Tabs.Screen
          name="shop"
          options={{
            title: m.manage.title,
            tabBarLabel: m.tabs.shop,
            tabBarIcon: ({ color }) => <Ionicons name="storefront" size={26} color={color} />,
          }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="me"
        options={{
          title: m.me.title,
          tabBarLabel: m.tabs.me,
          tabBarIcon: ({ color }) => <Ionicons name="person-circle" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}
