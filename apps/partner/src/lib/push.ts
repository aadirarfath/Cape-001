import { pushTokenInputSchema } from '@cape001/core';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { m } from '@/i18n';

import { supabase } from './supabase';

// Expo push notifications for new and cancelled bookings (sent by the notify-booking Edge
// Function). Remote push does not work in Expo Go on Android (SDK 53+), so in Expo Go this module
// never loads expo-notifications and reports 'expo-go'; a development build is needed.

export type PushState =
  | 'expo-go' // running in Expo Go: no remote push
  | 'unavailable' // emulator, web, or no EAS project id configured
  | 'denied'
  | 'undetermined'
  | 'enabled';

/** Must match ANDROID_CHANNEL_ID in supabase/functions/notify-booking/push.ts. */
export const BOOKINGS_CHANNEL_ID = 'bookings';

const TOKEN_KEY = 'cape001-push-token';

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function unsupported(): PushState | null {
  if (isExpoGo) return 'expo-go';
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'unavailable';
  if (!Device.isDevice || !projectId()) return 'unavailable';
  return null;
}

/** Loaded lazily so Expo Go never imports expo-notifications. */
export async function loadNotifications() {
  return import('expo-notifications');
}

export async function getPushState(): Promise<PushState> {
  const reason = unsupported();
  if (reason) return reason;
  const Notifications = await loadNotifications();
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'enabled' : status === 'denied' ? 'denied' : 'undetermined';
}

/**
 * Sets up the Android channel, asks for permission if `ask` is true and the user hasn't decided,
 * and saves this device's Expo push token for the logged-in user. Safe to call on every launch.
 */
export async function registerForPush({ ask }: { ask: boolean }): Promise<PushState> {
  const reason = unsupported();
  if (reason) return reason;
  const Notifications = await loadNotifications();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(BOOKINGS_CHANNEL_ID, {
      name: m.notifications.channelName,
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined' && ask) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return status === 'denied' ? 'denied' : 'undetermined';

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  const row = pushTokenInputSchema.parse({ token, platform: Platform.OS });
  const { error } = await supabase.from('push_tokens').upsert(row, { onConflict: 'user_id,token' });
  if (error) throw error;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  return 'enabled';
}

/** Forget this device's token for the current user. Call before signing out. */
export async function unregisterPush(): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  const { error } = await supabase.from('push_tokens').delete().eq('token', token);
  if (error) console.warn('Removing the push token failed', error.message);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** The booking a tapped notification refers to, if any. */
export function bookingIdFromNotificationData(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const { type, bookingId } = data as Record<string, unknown>;
  return type === 'booking' && typeof bookingId === 'string' ? bookingId : null;
}
