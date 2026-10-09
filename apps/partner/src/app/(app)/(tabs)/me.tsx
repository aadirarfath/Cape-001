import { formatPhone, fullNameSchema } from '@cape001/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';

import { Body, Button, Card, Chip, ChipRow, ConfirmDialog, Label, MenuItem, Muted, Notice, Screen, Section, TextField } from '@/components/ui';
import { errorMessage, m } from '@/i18n';
import { getPushState, type PushState, registerForPush, unregisterPush } from '@/lib/push';
import { useSession, useShop } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const t = m.me;

export default function MeScreen() {
  const { profile, shops, selectShop, refresh, signOut } = useSession();
  const shop = useShop();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [push, setPush] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Re-read on focus: the user may come back from the phone's settings.
  useFocusEffect(
    useCallback(() => {
      getPushState().then(setPush, () => setPush('unavailable'));
    }, []),
  );

  async function saveName() {
    const parsed = fullNameSchema.safeParse(name);
    if (!parsed.success) {
      setNameMessage({ tone: 'error', text: m.errors.codes.INVALID_NAME });
      return;
    }
    setSavingName(true);
    setNameMessage(null);
    const { error } = await supabase.rpc('update_my_profile', { p_full_name: parsed.data });
    setSavingName(false);
    if (error) {
      setNameMessage({ tone: 'error', text: errorMessage(error) });
      return;
    }
    setNameMessage({ tone: 'success', text: m.common.saved });
    refresh().catch(() => {});
  }

  async function turnOnNotifications() {
    if (push === 'denied') {
      await Linking.openSettings();
      return;
    }
    setPushBusy(true);
    try {
      setPush(await registerForPush({ ask: true }));
    } catch {
      setPush(await getPushState().catch(() => 'unavailable' as const));
    } finally {
      setPushBusy(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    await unregisterPush().catch(() => {});
    await signOut();
  }

  const pushText: Record<PushState, string> = {
    enabled: t.notificationsOn,
    denied: t.notificationsOff,
    undetermined: t.notificationsOff,
    'expo-go': t.notificationsExpoGo,
    unavailable: t.notificationsUnavailable,
  };

  return (
    <Screen>
      <Section>
        <TextField
          label={t.name}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={60}
        />
        {name.trim() !== (profile?.full_name ?? '') ? (
          <Button label={m.common.save} loading={savingName} onPress={saveName} />
        ) : null}
        {nameMessage ? <Notice tone={nameMessage.tone}>{nameMessage.text}</Notice> : null}
      </Section>

      <Card>
        <Muted>{t.phone}</Muted>
        <Body style={{ fontWeight: '600' }}>{profile?.phone ? formatPhone(profile.phone) : '–'}</Body>
        <Muted>{t.shop}</Muted>
        <Body style={{ fontWeight: '600' }}>{shop.name}</Body>
        <Muted>{t.role}</Muted>
        <Body style={{ fontWeight: '600' }}>{m.roles[shop.role]}</Body>
      </Card>

      {shop.barberId ? (
        <MenuItem
          icon="airplane"
          title={t.myTimeOff}
          onPress={() => router.push({ pathname: '/time-off/[barberId]', params: { barberId: shop.barberId! } })}
        />
      ) : null}

      <Section title={t.notificationsTitle}>
        {push ? (
          <Notice tone={push === 'enabled' ? 'success' : push === 'expo-go' || push === 'unavailable' ? 'info' : 'warning'}>
            {pushText[push]}
          </Notice>
        ) : null}
        {push === 'undetermined' || push === 'denied' ? (
          <Button
            label={push === 'denied' ? t.notificationsSettings : t.notificationsTurnOn}
            icon="notifications"
            loading={pushBusy}
            onPress={turnOnNotifications}
          />
        ) : null}
      </Section>

      {shops.length > 1 ? (
        <Section>
          <Label>{t.switchShop}</Label>
          <ChipRow>
            {shops.map((s) => (
              <Chip key={s.id} label={s.name} selected={s.id === shop.id} onPress={() => selectShop(s.id)} />
            ))}
          </ChipRow>
        </Section>
      ) : null}

      <Button label={t.logout} icon="log-out" variant="secondary" onPress={() => setConfirmLogout(true)} />

      <ConfirmDialog
        visible={confirmLogout}
        title={t.logoutTitle}
        body={t.logoutBody}
        confirmLabel={t.logoutConfirm}
        loading={loggingOut}
        onConfirm={logout}
        onCancel={() => setConfirmLogout(false)}
      />
    </Screen>
  );
}
