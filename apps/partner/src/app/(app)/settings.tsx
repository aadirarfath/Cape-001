import { setShopLocationInputSchema, shopBookingSettingsSchema, shopDetailsSchema } from '@cape001/core';
import { useState } from 'react';

import { type Coordinates, LocationCapture } from '@/components/location-capture';
import { Button, Chip, ChipRow, Label, LoadingView, Notice, Screen, Section, TextField } from '@/components/ui';
import { errorMessage, format, formatDuration, m } from '@/i18n';
import { useSession, useShop } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { unwrap, useLoad } from '@/lib/use-load';

const t = m.settings;

const SLOT_INTERVALS = [10, 15, 20, 30, 60];
const DAYS_AHEAD = [7, 14, 30, 60, 90];
const CUTOFFS = [0, 30, 60, 120, 240, 1440];

/** The preset choices, plus the current value if it was set to something else. */
function withCurrent(options: number[], current: number): number[] {
  return options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
}

function cutoffLabel(minutes: number): string {
  if (minutes === 0) return t.cutoffNone;
  const time = minutes === 1440 ? m.common.oneDay : formatDuration(minutes);
  return format(t.cutoffBefore, { time });
}

type Field = 'name' | 'address' | 'city' | 'pin';

export default function SettingsScreen() {
  const shop = useShop();
  const data = useShopSettings(shop.id);

  if (data.loading && !data.data) return <LoadingView />;
  if (!data.data) {
    return (
      <Screen>
        <Notice tone="error">{errorMessage(data.error as { message?: string })}</Notice>
      </Screen>
    );
  }
  // Keyed by shop: the form starts from the saved details; focus reloads don't undo edits.
  return <SettingsForm key={shop.id} saved={data.data} />;
}

type SavedShop = NonNullable<ReturnType<typeof useShopSettings>['data']>;

function useShopSettings(shopId: string) {
  return useLoad(async () => {
    return unwrap(
      await supabase
        .from('shops')
        .select(
          'name, phone, description, address_line, area, city, postal_code, slot_interval_minutes, max_days_ahead, cancellation_cutoff_minutes',
        )
        .eq('id', shopId)
        .single(),
    );
  }, [shopId]);
}

function SettingsForm({ saved }: { saved: SavedShop }) {
  const shop = useShop();
  const { refresh } = useSession();
  const [form, setForm] = useState(() => ({
    name: saved.name,
    phone: saved.phone ?? '',
    description: saved.description ?? '',
    address_line: saved.address_line,
    area: saved.area ?? '',
    city: saved.city,
    postal_code: saved.postal_code ?? '',
    slot_interval_minutes: saved.slot_interval_minutes,
    max_days_ahead: saved.max_days_ahead,
    cancellation_cutoff_minutes: saved.cancellation_cutoff_minutes,
  }));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm({ ...form, [key]: value });
    setMessage(null);
  };

  async function save() {
    const details = shopDetailsSchema.safeParse(form);
    const booking = shopBookingSettingsSchema.safeParse(form);
    if (!details.success) {
      const fieldErrors: Partial<Record<Field, string>> = {};
      for (const issue of details.error.issues) {
        const key = issue.path[0];
        if (key === 'name') fieldErrors.name = m.errors.required;
        if (key === 'address_line') fieldErrors.address = m.errors.required;
        if (key === 'city') fieldErrors.city = m.errors.required;
        if (key === 'postal_code') fieldErrors.pin = t.invalidPin;
      }
      setErrors(fieldErrors);
      return;
    }
    if (!booking.success) {
      setMessage({ tone: 'error', text: m.errors.generic });
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase.from('shops').update({ ...details.data, ...booking.data }).eq('id', shop.id);
    setSaving(false);
    if (error) {
      setMessage({ tone: 'error', text: errorMessage(error) });
      return;
    }
    setMessage({ tone: 'success', text: t.saved });
    refresh().catch(() => {}); // the shop name shows in the header
  }

  async function saveLocation(coordinates: Coordinates) {
    const input = setShopLocationInputSchema.parse({ p_shop_id: shop.id, p_lng: coordinates.lng, p_lat: coordinates.lat });
    setLocationSaving(true);
    setLocationError(null);
    const { error } = await supabase.rpc('set_shop_location', input);
    setLocationSaving(false);
    if (error) {
      setLocationError(errorMessage(error));
      throw error; // LocationCapture shows its own "couldn't" message too
    }
    await refresh().catch(() => {});
  }

  return (
    <Screen footer={<Button label={saving ? m.common.saving : m.common.save} icon="checkmark" loading={saving} onPress={save} />}>
      <Section title={t.detailsTitle}>
        <TextField label={t.name} value={form.name} onChangeText={(v) => set('name', v)} maxLength={100} error={errors.name} />
        <TextField label={t.phone} value={form.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" maxLength={20} />
        <TextField
          label={t.address}
          value={form.address_line}
          onChangeText={(v) => set('address_line', v)}
          maxLength={200}
          error={errors.address}
        />
        <TextField label={t.area} value={form.area} onChangeText={(v) => set('area', v)} maxLength={100} />
        <TextField label={t.city} value={form.city} onChangeText={(v) => set('city', v)} maxLength={100} error={errors.city} />
        <TextField
          label={t.pin}
          value={form.postal_code}
          onChangeText={(v) => set('postal_code', v)}
          keyboardType="number-pad"
          maxLength={6}
          error={errors.pin}
        />
        <TextField
          label={`${t.description} (${m.common.optional})`}
          value={form.description}
          onChangeText={(v) => set('description', v)}
          placeholder={t.descriptionPlaceholder}
          maxLength={1000}
          multiline
        />
      </Section>

      <Section title={t.bookingTitle}>
        <Label>{t.slotInterval}</Label>
        <ChipRow>
          {withCurrent(SLOT_INTERVALS, form.slot_interval_minutes).map((minutes) => (
            <Chip
              key={minutes}
              label={formatDuration(minutes)}
              selected={form.slot_interval_minutes === minutes}
              onPress={() => set('slot_interval_minutes', minutes)}
            />
          ))}
        </ChipRow>
        <Label>{t.daysAhead}</Label>
        <ChipRow>
          {withCurrent(DAYS_AHEAD, form.max_days_ahead).map((days) => (
            <Chip
              key={days}
              label={format(m.common.days, { days })}
              selected={form.max_days_ahead === days}
              onPress={() => set('max_days_ahead', days)}
            />
          ))}
        </ChipRow>
        <Label>{t.cutoff}</Label>
        <ChipRow>
          {withCurrent(CUTOFFS, form.cancellation_cutoff_minutes).map((minutes) => (
            <Chip
              key={minutes}
              label={cutoffLabel(minutes)}
              selected={form.cancellation_cutoff_minutes === minutes}
              onPress={() => set('cancellation_cutoff_minutes', minutes)}
            />
          ))}
        </ChipRow>
      </Section>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <Section title={t.locationTitle}>
        <LocationCapture value={{ lng: shop.lng, lat: shop.lat }} onChange={saveLocation} saving={locationSaving} />
        {locationError ? <Notice tone="error">{locationError}</Notice> : null}
      </Section>
    </Screen>
  );
}
