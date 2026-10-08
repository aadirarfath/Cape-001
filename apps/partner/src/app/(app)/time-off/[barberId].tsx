import {
  addDaysToLocalDate,
  formatLocalDate,
  localDateOf,
  localDateTimeToIso,
  localTimeOf,
  timeOffInputSchema,
  todayInAppTimeZone,
} from '@cape001/core';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { formatTime } from '@/components/booking';
import { DateButton, TimeButton } from '@/components/pickers';
import {
  Body,
  Button,
  Card,
  Chip,
  ChipRow,
  ConfirmDialog,
  EmptyState,
  LoadingView,
  Muted,
  Notice,
  Screen,
  Section,
  TextField,
} from '@/components/ui';
import { errorMessage, format, m } from '@/i18n';
import { useShop } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { unwrap, useLoad } from '@/lib/use-load';
import { space } from '@/theme';

const t = m.timeOff;

const dateFormat: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };

/** "Mon, 5 Oct – Wed, 7 Oct" for whole days, "Mon, 5 Oct, 2:00 pm – 6:00 pm" otherwise. */
function describe(startsAt: string, endsAt: string): string {
  const startDate = localDateOf(startsAt);
  const wholeDays = localTimeOf(startsAt) === '00:00' && localTimeOf(endsAt) === '00:00';
  if (wholeDays) {
    const lastDay = addDaysToLocalDate(localDateOf(endsAt), -1);
    if (lastDay === startDate) return formatLocalDate(startDate, dateFormat);
    return format(t.wholeDaysRange, {
      from: formatLocalDate(startDate, dateFormat),
      to: formatLocalDate(lastDay, dateFormat),
    });
  }
  return format(t.sameDayRange, {
    date: formatLocalDate(startDate, dateFormat),
    from: formatTime(startsAt),
    to: localDateOf(endsAt) === startDate ? formatTime(endsAt) : `${formatLocalDate(localDateOf(endsAt), dateFormat)}, ${formatTime(endsAt)}`,
  });
}

export default function TimeOffScreen() {
  const { barberId } = useLocalSearchParams<{ barberId: string }>();
  const shop = useShop();
  const today = todayInAppTimeZone();

  const data = useLoad(async () => {
    const [barber, rows] = await Promise.all([
      supabase.from('barbers').select('display_name').eq('id', barberId).single(),
      supabase
        .from('time_off')
        .select('id, starts_at, ends_at, reason')
        .eq('barber_id', barberId)
        .gte('ends_at', new Date().toISOString())
        .order('starts_at'),
    ]);
    return { name: unwrap(barber).display_name, rows: unwrap(rows) };
  }, [barberId]);

  const [adding, setAdding] = useState(false);
  const [wholeDays, setWholeDays] = useState(true);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (data.loading && !data.data) return <LoadingView />;

  async function save() {
    const starts_at = localDateTimeToIso(fromDate, wholeDays ? '00:00' : startTime);
    const ends_at = wholeDays
      ? localDateTimeToIso(addDaysToLocalDate(toDate, 1), '00:00')
      : localDateTimeToIso(fromDate, endTime);
    const parsed = timeOffInputSchema.safeParse({ barber_id: barberId, shop_id: shop.id, starts_at, ends_at, reason });
    if (!parsed.success) {
      setFormError(t.endBeforeStart);
      return;
    }
    setFormError(null);
    setSaving(true);
    const { error } = await supabase.from('time_off').insert(parsed.data);
    setSaving(false);
    if (error) {
      setFormError(errorMessage(error));
      return;
    }
    setAdding(false);
    setReason('');
    setSaved(true);
    await data.reload();
  }

  async function remove(id: string) {
    setDeleting(id);
    setDeleteError(null);
    const { error } = await supabase.from('time_off').delete().eq('id', id);
    setDeleting(null);
    if (error) {
      setDeleteError(errorMessage(error));
      return;
    }
    setConfirmDelete(null);
    await data.reload();
  }

  return (
    <Screen onRefresh={data.refresh} refreshing={data.refreshing}>
      <Muted>{format(t.subtitle, { name: data.data?.name ?? '' })}</Muted>
      {data.error ? <Notice tone="error">{errorMessage(data.error as { message?: string })}</Notice> : null}
      {saved && !adding ? <Notice tone="success">{t.saved}</Notice> : null}

      {adding ? (
        <Card>
          <ChipRow>
            <Chip label={t.wholeDays} selected={wholeDays} onPress={() => setWholeDays(true)} />
            <Chip label={t.partDay} selected={!wholeDays} onPress={() => setWholeDays(false)} />
          </ChipRow>
          {wholeDays ? (
            <>
              <DateButton
                label={t.from}
                value={fromDate}
                minimumDate={today}
                onChange={(d) => {
                  setFromDate(d);
                  if (toDate < d) setToDate(d);
                }}
              />
              <DateButton label={t.to} value={toDate} minimumDate={fromDate} onChange={setToDate} />
            </>
          ) : (
            <>
              <DateButton label={t.date} value={fromDate} minimumDate={today} onChange={setFromDate} />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <TimeButton label={t.startTime} value={startTime} onChange={setStartTime} />
                <TimeButton label={t.endTime} value={endTime} onChange={setEndTime} />
              </View>
            </>
          )}
          <TextField
            label={`${t.reason} (${m.common.optional})`}
            value={reason}
            onChangeText={setReason}
            placeholder={t.reasonPlaceholder}
            maxLength={200}
          />
          {formError ? <Notice tone="error">{formError}</Notice> : null}
          <Button label={t.save} icon="checkmark" loading={saving} onPress={save} />
          <Button label={m.common.cancel} variant="ghost" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button
          label={t.add}
          icon="add"
          onPress={() => {
            setAdding(true);
            setSaved(false);
          }}
        />
      )}

      <Section title={t.upcoming}>
        {data.data?.rows.length === 0 ? <EmptyState icon="sunny-outline" title={t.empty} /> : null}
        {data.data?.rows.map((row) => (
          <Card key={row.id}>
            <Body style={{ fontWeight: '600' }}>{describe(row.starts_at, row.ends_at)}</Body>
            {row.reason ? <Muted>{row.reason}</Muted> : null}
            <Button label={m.common.delete} icon="trash" variant="ghost" onPress={() => setConfirmDelete(row.id)} />
          </Card>
        ))}
      </Section>

      <ConfirmDialog
        visible={confirmDelete !== null}
        title={t.deleteTitle}
        confirmLabel={t.deleteConfirm}
        destructive
        loading={deleting !== null}
        error={deleteError}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        onCancel={() => {
          setConfirmDelete(null);
          setDeleteError(null);
        }}
      />
    </Screen>
  );
}
