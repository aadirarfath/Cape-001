import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { m } from '@/i18n';
import { bookingIdFromNotificationData, isExpoGo, loadNotifications, registerForPush } from '@/lib/push';
import { useSession } from '@/lib/session';
import { useHeaderOptions } from '../_layout';

export default function AppLayout() {
  const { isManager, session } = useSession();
  const headerOptions = useHeaderOptions();
  const userId = session?.user.id;

  // Save this phone's push token for the logged-in user (asks for permission the first time).
  useEffect(() => {
    if (!userId) return;
    registerForPush({ ask: true }).catch((error) => console.warn('Push registration failed', error));
  }, [userId]);

  // Show notifications while the app is open, and open the booking when one is tapped.
  useEffect(() => {
    if (isExpoGo) return;
    let subscription: { remove: () => void } | undefined;
    let cancelled = false;
    loadNotifications().then(async (Notifications) => {
      if (cancelled) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      const open = (data: unknown) => {
        const bookingId = bookingIdFromNotificationData(data);
        if (bookingId) router.push({ pathname: '/booking/[id]', params: { id: bookingId } });
      };
      subscription = Notifications.addNotificationResponseReceivedListener((response) =>
        open(response.notification.request.content.data),
      );
      // The app was started by tapping a notification.
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last && !cancelled) {
        open(last.notification.request.content.data);
        await Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="booking/[id]" options={{ title: m.booking.title }} />
      <Stack.Screen name="time-off/[barberId]" options={{ title: m.timeOff.title }} />
      {/* Shop management: owners and managers only. */}
      <Stack.Protected guard={isManager}>
        <Stack.Screen name="barbers/index" options={{ title: m.barbers.title }} />
        <Stack.Screen name="barbers/[id]" options={{ title: m.barbers.editTitle }} />
        <Stack.Screen name="hours/[barberId]" options={{ title: m.hours.title }} />
        <Stack.Screen name="services/index" options={{ title: m.services.title }} />
        <Stack.Screen name="services/[id]" options={{ title: m.services.editTitle }} />
        <Stack.Screen name="settings" options={{ title: m.settings.title }} />
        <Stack.Screen name="photos" options={{ title: m.photos.title }} />
      </Stack.Protected>
    </Stack>
  );
}
