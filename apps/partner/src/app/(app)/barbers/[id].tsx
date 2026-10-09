import { barberInputSchema, formatPhone, inviteBarberInputSchema } from '@cape001/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import {
  Button,
  Card,
  CheckRow,
  Label,
  LoadingView,
  MenuItem,
  Muted,
  Notice,
  Screen,
  Section,
  SwitchRow,
  TextField,
} from '@/components/ui';
import { errorMessage, format, m } from '@/i18n';
import { useSession, useShop } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { unwrap, useLoad } from '@/lib/use-load';

const t = m.barbers;

type Message = { tone: 'success' | 'error' | 'warning'; text: string } | null;

export default function BarberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const shop = useShop();
  const data = useBarberData(id, isNew, shop.id);

  if (data.loading && !data.data) return <LoadingView />;
  if (!data.data) {
    return (
      <Screen onRefresh={data.refresh} refreshing={data.refreshing}>
        <Notice tone="error">{errorMessage(data.error as { message?: string })}</Notice>
      </Screen>
    );
  }
  // Keyed by id: the form starts from the loaded values, and a new barber gets a fresh form.
  return <BarberForm key={id} isNew={isNew} data={data.data} reload={data.reload} />;
}

type BarberData = NonNullable<ReturnType<typeof useBarberData>['data']>;

function useBarberData(id: string, isNew: boolean, shopId: string) {
  return useLoad(async () => {
    const services = unwrap(
      await supabase.from('services').select('id, name, is_active').eq('shop_id', shopId).order('sort_order').order('name'),
    );
    if (isNew) return { services, barber: null, serviceIds: [] as string[], invitePhone: null, linkedName: null };

    const [barber, offered, invite] = await Promise.all([
      supabase.from('barbers').select('id, display_name, bio, is_active, user_id').eq('id', id).single(),
      supabase.from('barber_services').select('service_id').eq('barber_id', id),
      supabase.from('barber_invites').select('phone').eq('barber_id', id).maybeSingle(),
    ]);
    const b = unwrap(barber);
    let linkedName: string | null = null;
    if (b.user_id) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', b.user_id).maybeSingle();
      linkedName = profile?.full_name ?? null;
    }
    return {
      services,
      barber: b,
      serviceIds: unwrap(offered).map((row) => row.service_id),
      invitePhone: unwrap(invite)?.phone ?? null,
      linkedName,
    };
  }, [id, shopId]);
}

function BarberForm({
  isNew,
  data,
  reload,
}: {
  isNew: boolean;
  data: BarberData;
  reload: () => Promise<void>;
}) {
  const shop = useShop();
  const { isOwner } = useSession();
  const { services, barber } = data;
  const [name, setName] = useState(barber?.display_name ?? '');
  const [bio, setBio] = useState(barber?.bio ?? '');
  const [active, setActive] = useState(barber?.is_active ?? true);
  // A new barber offers every active service by default; untick what they don't do.
  const [serviceIds, setServiceIds] = useState<Set<string>>(
    () => new Set(barber ? data.serviceIds : services.filter((s) => s.is_active).map((s) => s.id)),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<Message>(null);

  function toggleService(serviceId: string) {
    setServiceIds((current) => {
      const next = new Set(current);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }

  async function save() {
    const parsed = barberInputSchema.safeParse({ display_name: name, bio, is_active: active });
    if (!parsed.success) {
      setNameError(m.errors.required);
      return;
    }
    setNameError(null);
    setSaving(true);
    setMessage(null);
    try {
      let barberId = barber?.id;
      if (barberId) {
        unwrap(await supabase.from('barbers').update(parsed.data).eq('id', barberId));
      } else {
        const created = unwrap(
          await supabase.from('barbers').insert({ ...parsed.data, shop_id: shop.id }).select('id').single(),
        );
        barberId = created.id;
      }
      unwrap(await supabase.rpc('set_barber_services', { p_barber_id: barberId, p_service_ids: [...serviceIds] }));

      if (isNew) {
        // Open the saved barber so hours, time off and the app login can be set up next.
        router.replace({ pathname: '/barbers/[id]', params: { id: barberId } });
        return;
      }
      setMessage(
        serviceIds.size === 0 && active
          ? { tone: 'warning', text: t.noServicesSelected }
          : { tone: 'success', text: m.common.saved },
      );
      await reload();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e as { message?: string }) });
    } finally {
      setSaving(false);
    }
  }

  async function invite(remove: boolean) {
    if (!barber) return;
    let p_phone: string | null = null;
    if (!remove) {
      const parsed = inviteBarberInputSchema.safeParse({ p_barber_id: barber.id, p_phone: phone });
      if (!parsed.success) {
        setInviteMessage({ tone: 'error', text: m.errors.codes.INVALID_PHONE });
        return;
      }
      p_phone = parsed.data.p_phone;
    }
    setInviteBusy(true);
    setInviteMessage(null);
    // invite_barber with a null phone withdraws the invite.
    const { error } = await supabase.rpc('invite_barber', { p_barber_id: barber.id, p_phone: p_phone as string });
    setInviteBusy(false);
    if (error) {
      setInviteMessage({ tone: 'error', text: errorMessage(error) });
      return;
    }
    setPhone('');
    setInviteMessage({
      tone: 'success',
      text: remove ? t.inviteRemoved : format(t.inviteSaved, { name: barber.display_name }),
    });
    await reload();
  }

  return (
    <Screen
      onRefresh={reload}
      footer={<Button label={saving ? m.common.saving : m.common.save} icon="checkmark" loading={saving} onPress={save} />}>
      <Stack.Screen options={{ title: isNew ? t.newTitle : barber?.display_name ?? t.editTitle }} />
      <Section>
        <TextField
          label={t.name}
          value={name}
          onChangeText={setName}
          placeholder={t.namePlaceholder}
          autoCapitalize="words"
          maxLength={80}
          error={nameError}
        />
        <TextField
          label={`${t.bio} (${m.common.optional})`}
          value={bio}
          onChangeText={setBio}
          placeholder={t.bioPlaceholder}
          maxLength={500}
          multiline
        />
        <SwitchRow label={t.active} hint={t.activeHint} value={active} onValueChange={setActive} />
      </Section>

      <Section title={t.services}>
        {services.length === 0 ? <Muted>{t.noServices}</Muted> : null}
        {services.map((s) => (
          <CheckRow
            key={s.id}
            label={s.name}
            subtitle={s.is_active ? undefined : m.services.inactive}
            checked={serviceIds.has(s.id)}
            onToggle={() => toggleService(s.id)}
          />
        ))}
      </Section>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {barber ? (
        <>
          <Section>
            <MenuItem
              icon="time"
              title={t.workingHours}
              onPress={() => router.push({ pathname: '/hours/[barberId]', params: { barberId: barber.id } })}
            />
            <MenuItem
              icon="airplane"
              title={t.timeOff}
              onPress={() => router.push({ pathname: '/time-off/[barberId]', params: { barberId: barber.id } })}
            />
          </Section>

          <Card>
            <Label>{t.appTitle}</Label>
            {barber.user_id ? (
              <Muted>{format(t.appLinked, { name: data.linkedName || barber.display_name })}</Muted>
            ) : data.invitePhone ? (
              <Muted>{format(t.appInvited, { phone: formatPhone(data.invitePhone) })}</Muted>
            ) : (
              <Muted>{isOwner ? t.appInvite : t.appOwnerOnly}</Muted>
            )}
            {isOwner && !barber.user_id ? (
              <>
                <TextField
                  label={t.invitePhone}
                  prefix="+91"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder={m.auth.login.phonePlaceholder}
                  maxLength={16}
                />
                <Button label={t.sendInvite} icon="send" loading={inviteBusy} onPress={() => invite(false)} />
                {data.invitePhone ? (
                  <Button label={t.removeInvite} variant="ghost" disabled={inviteBusy} onPress={() => invite(true)} />
                ) : null}
              </>
            ) : null}
            {inviteMessage ? <Notice tone={inviteMessage.tone}>{inviteMessage.text}</Notice> : null}
          </Card>
        </>
      ) : (
        <Muted>{t.saveFirst}</Muted>
      )}
    </Screen>
  );
}
