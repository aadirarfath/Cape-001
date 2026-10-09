import { addDaysToLocalDate, formatLocalDate, localDayBounds, todayInAppTimeZone } from '@cape001/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BookingCard, type BookingListItem } from '@/components/booking';
import { DateButton } from '@/components/pickers';
import { Button, Chip, ChipRow, EmptyState, LoadingView, Muted, Notice, Screen } from '@/components/ui';
import { errorMessage, format, m } from '@/i18n';
import { useSession, useShop } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { unwrap, useLoad } from '@/lib/use-load';
import { radius, space, touchHeight, useColors } from '@/theme';

function dayLabel(date: string, today: string): string {
  if (date === today) return m.schedule.today;
  if (date === addDaysToLocalDate(today, 1)) return m.schedule.tomorrow;
  if (date === addDaysToLocalDate(today, -1)) return m.schedule.yesterday;
  return formatLocalDate(date, { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function ScheduleScreen() {
  const shop = useShop();
  const { isManager } = useSession();
  const colors = useColors();
  const [today, setToday] = useState(() => todayInAppTimeZone());
  const [date, setDate] = useState(today);
  const [barberFilter, setBarberFilter] = useState<string | null>(null);

  // Barbers only ever see their own bookings (RLS enforces it too).
  const ownBarberId = isManager ? null : shop.barberId;

  const barbers = useLoad(async () => {
    if (!isManager) return [];
    return unwrap(
      await supabase
        .from('barbers')
        .select('id, display_name, is_active')
        .eq('shop_id', shop.id)
        .order('sort_order')
        .order('display_name'),
    );
  }, [shop.id, isManager]);

  const bookings = useLoad(async (): Promise<BookingListItem[]> => {
    if (!isManager && !ownBarberId) return [];
    const { start, end } = localDayBounds(date);
    let query = supabase
      .from('bookings')
      .select(
        'id, starts_at, ends_at, status, barber_id, customer:profiles!bookings_customer_id_fkey (full_name), service:services (name), barber:barbers (display_name)',
      )
      .eq('shop_id', shop.id)
      .gte('starts_at', start)
      .lt('starts_at', end)
      .order('starts_at');
    if (ownBarberId) query = query.eq('barber_id', ownBarberId);
    const rows = unwrap(await query);
    return rows.map((row) => ({
      id: row.id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: row.status,
      barberId: row.barber_id,
      customerName: row.customer?.full_name ?? null,
      serviceName: row.service?.name ?? '',
      barberName: row.barber?.display_name ?? '',
    }));
  }, [shop.id, date, isManager, ownBarberId]);

  // New, changed and cancelled bookings arrive through Realtime; RLS decides which rows this
  // user receives. Any change reloads the day so customer names come through RLS as well.
  const reloadBookings = bookings.reload; // stable across renders
  useEffect(() => {
    const channel = supabase
      .channel(`bookings:${shop.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `shop_id=eq.${shop.id}` },
        () => {
          reloadBookings();
        },
      )
      // Also reload whenever the channel (re)connects: changes made while the phone was offline,
      // or before the subscription was ready, are not replayed by Realtime.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') reloadBookings();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [shop.id, reloadBookings]);

  // Keep "today" right if the app stays open past midnight.
  useEffect(() => {
    const timer = setInterval(() => setToday(todayInAppTimeZone()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const visible = useMemo(
    () => (bookings.data ?? []).filter((b) => !barberFilter || b.barberId === barberFilter),
    [bookings.data, barberFilter],
  );
  const activeCount = visible.filter((b) => b.status !== 'cancelled').length;

  if (bookings.loading && !bookings.data) return <LoadingView />;

  return (
    <Screen onRefresh={bookings.refresh} refreshing={bookings.refreshing}>
      <View style={styles.dateRow}>
        <Pressable
          onPress={() => setDate(addDaysToLocalDate(date, -1))}
          accessibilityRole="button"
          accessibilityLabel={m.schedule.previousDay}
          style={({ pressed }) => [styles.arrow, { borderColor: colors.border, backgroundColor: colors.card }, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={30} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <DateButton value={date} onChange={setDate} />
        </View>
        <Pressable
          onPress={() => setDate(addDaysToLocalDate(date, 1))}
          accessibilityRole="button"
          accessibilityLabel={m.schedule.nextDay}
          style={({ pressed }) => [styles.arrow, { borderColor: colors.border, backgroundColor: colors.card }, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-forward" size={30} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <Muted style={{ fontWeight: '700' }}>{dayLabel(date, today)}</Muted>
        <Muted>
          {activeCount === 1 ? m.schedule.countOne : format(m.schedule.count, { count: activeCount })}
        </Muted>
      </View>
      {date !== today ? (
        <Button label={m.schedule.goToToday} variant="secondary" icon="today" onPress={() => setDate(today)} />
      ) : null}

      {isManager && (barbers.data?.length ?? 0) > 1 ? (
        <ChipRow>
          <Chip label={m.schedule.allBarbers} selected={barberFilter === null} onPress={() => setBarberFilter(null)} />
          {barbers.data
            ?.filter((b) => b.is_active || b.id === barberFilter)
            .map((b) => (
              <Chip key={b.id} label={b.display_name} selected={barberFilter === b.id} onPress={() => setBarberFilter(b.id)} />
            ))}
        </ChipRow>
      ) : null}

      {!isManager && !ownBarberId ? <Notice tone="warning">{m.schedule.noBarberProfile}</Notice> : null}
      {bookings.error ? <Notice tone="error">{errorMessage(bookings.error as { message?: string })}</Notice> : null}

      {visible.length === 0 && !bookings.error ? (
        <EmptyState icon="calendar-clear-outline" title={m.schedule.empty} body={m.schedule.emptyHint} />
      ) : (
        visible.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            showBarber={isManager && !barberFilter}
            onPress={() => router.push({ pathname: '/booking/[id]', params: { id: booking.id } })}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  arrow: {
    width: touchHeight,
    height: touchHeight,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
