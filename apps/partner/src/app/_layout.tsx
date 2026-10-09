import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import { Body, Button, Notice, Title } from '@/components/ui';
import { errorMessage, m } from '@/i18n';
import { SessionProvider, useSession } from '@/lib/session';
import { font, space, useColors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </ThemeProvider>
  );
}

// Which part of the app the user may see is decided here, from the session (see lib/session.tsx).
// When a guard flips, expo-router moves to the first screen that is allowed.
function RootNavigator() {
  const { status, profile, shop } = useSession();
  const colors = useColors();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === 'loading') return null; // the splash screen stays up
  if (status === 'error') return <SessionError />;

  const signedIn = status === 'signedIn';
  const needsName = signedIn && !profile?.full_name;
  const needsShop = signedIn && !needsName && !shop;
  const pending = signedIn && !needsName && !!shop && !shop.isActive;
  const ready = signedIn && !needsName && !!shop?.isActive;

  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontSize: font.large },
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="verify" options={{ title: '' }} />
      </Stack.Protected>
      <Stack.Protected guard={needsName}>
        <Stack.Screen name="your-name" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={needsShop}>
        <Stack.Screen name="create-shop" options={{ title: m.onboarding.createShop.title }} />
      </Stack.Protected>
      <Stack.Protected guard={pending}>
        <Stack.Screen name="pending" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

/** Logged in, but the profile or shops couldn't be loaded (usually no internet). */
function SessionError() {
  const { refresh, signOut } = useSession();
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      await refresh();
    } catch (e) {
      setError(errorMessage(e as { message?: string }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, gap: space.lg, backgroundColor: colors.background }}>
      <Title>{m.app.name}</Title>
      <Body>{m.errors.network}</Body>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button label={m.common.retry} icon="refresh" loading={busy} onPress={retry} />
      <Button label={m.me.logout} variant="ghost" onPress={() => signOut()} />
    </View>
  );
}
