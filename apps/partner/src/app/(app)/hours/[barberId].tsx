import { type WorkingHoursEntry, workingHoursSchema } from '@cape001/core';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { TimeButton } from '@/components/pickers';
import { Button, Card, LoadingView, Muted, Notice, Screen, SwitchRow } from '@/components/ui';
import { errorMessage, format, m } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { unwrap, useLoad } from '@/lib/use-load';
import { space } from '@/theme';

const t = m.hours;

/** Monday first, as people in India read a week; values are database weekdays (0 = Sunday). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

interface Shift {
  start: string;
  end: string;
}

interface Day {
  working: boolean;
  shifts: Shift[]; // one or two
}

const DEFAULT_SHIFT: Shift = { start: '09:00', end: '18:00' };

function toDays(rows: { weekday: number; start_time: string; end_time: string }[]): Record<number, Day> {
  const days: Record<number, Day> = {};
  for (const weekday of WEEK) {
    const shifts = rows
      .filter((r) => r.weekday === weekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .slice(0, 2)
      .map((r) => ({ start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) }));
    days[weekday] = { working: shifts.length > 0, shifts: shifts.length > 0 ? shifts : [DEFAULT_SHIFT] };
  }
  return days;
}

function toEntries(days: Record<number, Day>): WorkingHoursEntry[] {
  return WEEK.flatMap((weekday) =>
    days[weekday]?.working
      ? days[weekday].shifts.map((s) => ({ weekday, start_time: s.start, end_time: s.end }))
      : [],
  );
}

export default function WorkingHoursScreen() {
  const { barberId } = useLocalSearchParams<{ barberId: string }>();

  const data = useLoad(async () => {
    const [barber, hours] = await Promise.all([
      supabase.from('barbers').select('display_name').eq('id', barberId).single(),
      supabase.from('working_hours').select('weekday, start_time, end_time').eq('barber_id', barberId),
    ]);
    return { name: unwrap(barber).display_name, rows: unwrap(hours) };
  }, [barberId]);

  if (data.loading && !data.data) return <LoadingView />;
  if (!data.data) {
    return (
      <Screen>
        <Notice tone="error">{errorMessage(data.error as { message?: string })}</Notice>
      </Screen>
    );
  }
  // Keyed by barber: the form starts from the saved hours; focus reloads don't undo edits.
  return <HoursForm key={barberId} barberId={barberId} name={data.data.name} rows={data.data.rows} />;
}

function HoursForm({
  barberId,
  name,
  rows,
}: {
  barberId: string;
  name: string;
  rows: { weekday: number; start_time: string; end_time: string }[];
}) {
  const [days, setDays] = useState<Record<number, Day>>(() => toDays(rows));
  const [dayErrors, setDayErrors] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  function update(weekday: number, change: (day: Day) => Day) {
    setDays((current) => ({ ...current, [weekday]: change(current[weekday]!) }));
    setMessage(null);
  }

  function setShift(weekday: number, index: number, field: keyof Shift, value: string) {
    update(weekday, (day) => ({
      ...day,
      shifts: day.shifts.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  }

  function copyMonday() {
    setDays((current) => {
      const monday = current[1];
      if (!monday) return current;
      const next = { ...current };
      for (const weekday of WEEK) {
        if (next[weekday]?.working) next[weekday] = { working: true, shifts: monday.shifts.map((s) => ({ ...s })) };
      }
      return next;
    });
    setMessage({ tone: 'info', text: t.copied });
  }

  async function save() {
    const entries = toEntries(days);
    const parsed = workingHoursSchema.safeParse(entries);
    if (!parsed.success) {
      const errors: Record<number, string> = {};
      for (const issue of parsed.error.issues) {
        const entry = entries[issue.path[0] as number];
        if (entry) errors[entry.weekday] = issue.message === 'OVERLAP' ? t.overlap : t.endBeforeStart;
      }
      setDayErrors(errors);
      return;
    }
    setDayErrors({});
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc('set_working_hours', { p_barber_id: barberId, p_hours: parsed.data });
    setSaving(false);
    setMessage(error ? { tone: 'error', text: errorMessage(error) } : { tone: 'success', text: t.saved });
  }

  return (
    <Screen
      footer={<Button label={saving ? m.common.saving : m.common.save} icon="checkmark" loading={saving} onPress={save} />}>
      <Muted>{format(t.subtitle, { name })}</Muted>
      <Button label={t.copyToAll} icon="copy" variant="secondary" onPress={copyMonday} />

      {WEEK.map((weekday) => {
        const day = days[weekday]!;
        return (
          <Card key={weekday}>
            <SwitchRow
              label={m.weekdays[weekday] ?? ''}
              hint={day.working ? t.working : t.closed}
              value={day.working}
              onValueChange={(working) => update(weekday, (d) => ({ ...d, working }))}
            />
            {day.working
              ? day.shifts.map((shift, index) => (
                  <View key={index} style={{ flexDirection: 'row', gap: space.sm }}>
                    <TimeButton label={t.from} value={shift.start} onChange={(v) => setShift(weekday, index, 'start', v)} />
                    <TimeButton label={t.to} value={shift.end} onChange={(v) => setShift(weekday, index, 'end', v)} />
                  </View>
                ))
              : null}
            {day.working && day.shifts.length === 1 ? (
              <Button
                label={t.addShift}
                variant="ghost"
                icon="add"
                onPress={() =>
                  update(weekday, (d) => ({
                    ...d,
                    // Split the day: morning keeps its start, afternoon resumes an hour after it ends.
                    shifts: [{ start: d.shifts[0]!.start, end: '13:00' }, { start: '14:00', end: d.shifts[0]!.end }],
                  }))
                }
              />
            ) : null}
            {day.working && day.shifts.length === 2 ? (
              <Button
                label={t.removeShift}
                variant="ghost"
                icon="remove"
                onPress={() =>
                  update(weekday, (d) => ({ ...d, shifts: [{ start: d.shifts[0]!.start, end: d.shifts[1]!.end }] }))
                }
              />
            ) : null}
            {dayErrors[weekday] ? <Notice tone="error">{dayErrors[weekday]}</Notice> : null}
          </Card>
        );
      })}

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </Screen>
  );
}
