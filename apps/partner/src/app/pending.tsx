import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Chip, ChipRow, Label, Notice, Screen, Title } from '@/components/ui';
import { errorMessage, format, m } from '@/i18n';
import { useSession } from '@/lib/session';
import { space, useColors } from '@/theme';

const t = m.onboarding.pending;

/** Shown while the selected shop waits for a platform admin to approve it. */
export default function PendingScreen() {
  const { shop, shops, refresh, selectShop, signOut } = useSession();
  const colors = useColors();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ tone: 'warning' | 'error'; text: string } | null>(null);

  async function checkAgain() {
    setChecking(true);
    setMessage(null);
    try {
      await refresh(); // once approved, the root layout opens the app
      setMessage({ tone: 'warning', text: t.stillPending });
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e as { message?: string }) });
    } finally {
      setChecking(false);
    }
  }

  return (
    <Screen onRefresh={checkAgain} refreshing={false}>
      <View style={{ alignItems: 'center', gap: space.lg, marginTop: space.xxl }}>
        <Ionicons name="hourglass-outline" size={72} color={colors.warning} />
        <Title style={{ textAlign: 'center' }}>{t.title}</Title>
        <Body style={{ textAlign: 'center' }}>{format(t.body, { shop: shop?.name ?? '' })}</Body>
      </View>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Button label={t.checkAgain} icon="refresh" loading={checking} onPress={checkAgain} />
      {shops.length > 1 ? (
        <View style={{ gap: space.sm }}>
          <Label>{m.me.switchShop}</Label>
          <ChipRow>
            {shops.map((s) => (
              <Chip key={s.id} label={s.name} selected={s.id === shop?.id} onPress={() => selectShop(s.id)} />
            ))}
          </ChipRow>
        </View>
      ) : null}
      <Button label={m.me.logout} variant="ghost" onPress={() => signOut()} />
    </Screen>
  );
}
