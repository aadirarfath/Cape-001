import { paiseToRupeesText, rupeesToPaiseSchema, serviceInputSchema } from '@cape001/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import {
  Button,
  CheckRow,
  Chip,
  ChipRow,
  Label,
  LoadingView,
  Muted,
  Notice,
  Screen,
  Section,
  SwitchRow,
  TextField,
} from '@/components/ui';
import { errorMessage, formatDuration, m } from '@/i18n';
import { useShop } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { unwrap, useLoad } from '@/lib/use-load';

const t = m.services;

const DURATIONS = [15, 20, 30, 45, 60, 90];

type Field = 'name' | 'price' | 'duration';

export default function ServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const shop = useShop();
  const data = useServiceData(id, isNew, shop.id);

  if (data.loading && !data.data) return <LoadingView />;
  if (!data.data) {
    return (
      <Screen onRefresh={data.refresh} refreshing={data.refreshing}>
        <Notice tone="error">{errorMessage(data.error as { message?: string })}</Notice>
      </Screen>
    );
  }
  // Keyed by id: the form starts from the loaded values.
  return <ServiceForm key={id} isNew={isNew} data={data.data} reload={data.reload} />;
}

type ServiceData = NonNullable<ReturnType<typeof useServiceData>['data']>;

function useServiceData(id: string, isNew: boolean, shopId: string) {
  return useLoad(async () => {
    const barbers = unwrap(
      await supabase
        .from('barbers')
        .select('id, display_name, is_active')
        .eq('shop_id', shopId)
        .order('sort_order')
        .order('display_name'),
    );
    if (isNew) return { barbers, service: null, barberIds: [] as string[] };
    const [service, offeredBy] = await Promise.all([
      supabase.from('services').select('id, name, description, duration_minutes, price_paise, is_active').eq('id', id).single(),
      supabase.from('barber_services').select('barber_id').eq('service_id', id),
    ]);
    return { barbers, service: unwrap(service), barberIds: unwrap(offeredBy).map((row) => row.barber_id) };
  }, [id, shopId]);
}

function ServiceForm({
  isNew,
  data,
  reload,
}: {
  isNew: boolean;
  data: ServiceData;
  reload: () => Promise<void>;
}) {
  const shop = useShop();
  const { barbers, service } = data;
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(service ? paiseToRupeesText(service.price_paise) : '');
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 30));
  const [active, setActive] = useState(service?.is_active ?? true);
  // A new service is offered by every active barber by default.
  const [barberIds, setBarberIds] = useState<Set<string>>(
    () => new Set(service ? data.barberIds : barbers.filter((b) => b.is_active).map((b) => b.id)),
  );
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  function toggleBarber(barberId: string) {
    setBarberIds((current) => {
      const next = new Set(current);
      if (next.has(barberId)) next.delete(barberId);
      else next.add(barberId);
      return next;
    });
  }

  async function save() {
    const fieldErrors: Partial<Record<Field, string>> = {};
    const paise = rupeesToPaiseSchema.safeParse(price);
    if (!paise.success) fieldErrors.price = t.invalidPrice;
    const parsed = serviceInputSchema.safeParse({
      name,
      description,
      duration_minutes: Number.parseInt(duration, 10),
      price_paise: paise.success ? paise.data : 0,
      is_active: active,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'name') fieldErrors.name = m.errors.required;
        if (issue.path[0] === 'duration_minutes') fieldErrors.duration = t.invalidDuration;
      }
    }
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0 || !parsed.success) return;

    setSaving(true);
    setMessage(null);
    try {
      const serviceId = service
        ? (unwrap(await supabase.from('services').update(parsed.data).eq('id', service.id)), service.id)
        : unwrap(await supabase.from('services').insert({ ...parsed.data, shop_id: shop.id }).select('id').single()).id;

      // Which barbers offer it: add the ticked ones, remove the unticked ones.
      const wanted = [...barberIds];
      if (wanted.length > 0) {
        unwrap(
          await supabase.from('barber_services').upsert(
            wanted.map((barber_id) => ({ barber_id, service_id: serviceId, shop_id: shop.id })),
            { onConflict: 'barber_id,service_id', ignoreDuplicates: true },
          ),
        );
      }
      const unwanted = barbers.map((b) => b.id).filter((barberId) => !barberIds.has(barberId));
      if (unwanted.length > 0) {
        unwrap(await supabase.from('barber_services').delete().eq('service_id', serviceId).in('barber_id', unwanted));
      }

      if (isNew) {
        router.back();
        return;
      }
      setMessage({ tone: 'success', text: m.common.saved });
      await reload();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e as { message?: string }) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      footer={<Button label={saving ? m.common.saving : m.common.save} icon="checkmark" loading={saving} onPress={save} />}>
      <Stack.Screen options={{ title: isNew ? t.newTitle : service?.name ?? t.editTitle }} />

      <Section>
        <TextField
          label={t.name}
          value={name}
          onChangeText={setName}
          placeholder={t.namePlaceholder}
          maxLength={100}
          error={errors.name}
        />
        <TextField
          label={t.price}
          prefix="₹"
          value={price}
          onChangeText={setPrice}
          placeholder={t.pricePlaceholder}
          keyboardType="decimal-pad"
          maxLength={9}
          error={errors.price}
        />
        <Label>{t.duration}</Label>
        <ChipRow>
          {DURATIONS.map((d) => (
            <Chip key={d} label={formatDuration(d)} selected={duration === String(d)} onPress={() => setDuration(String(d))} />
          ))}
        </ChipRow>
        <TextField
          label={t.customDuration}
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          maxLength={3}
          error={errors.duration}
        />
        <TextField
          label={`${t.description} (${m.common.optional})`}
          value={description}
          onChangeText={setDescription}
          placeholder={t.descriptionPlaceholder}
          maxLength={500}
          multiline
        />
        <SwitchRow label={t.active} hint={t.activeHint} value={active} onValueChange={setActive} />
      </Section>

      <Section title={t.barbers}>
        {barbers.length === 0 ? <Muted>{t.noBarbers}</Muted> : null}
        {barbers.map((b) => (
          <CheckRow
            key={b.id}
            label={b.display_name}
            subtitle={b.is_active ? undefined : m.barbers.inactive}
            checked={barberIds.has(b.id)}
            onToggle={() => toggleBarber(b.id)}
          />
        ))}
      </Section>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </Screen>
  );
}
