import { cancelBookingInputSchema, formatInAppTimeZone, formatPhone, formatPricePaise, telUrl } from '@cape001/core';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { type BookingStatus, formatTime, StatusBadge } from '@/components/booking';
import { Body, Button, Card, ConfirmDialog, EmptyState, LoadingView, Muted, Notice, Screen, TextField, Title } from '@/components/ui';
import { errorMessage, format, formatDuration, m } from '@/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { unwrap, useLoad } from '@/lib/use-load';
import { space } from '@/theme';

const t = m.booking;

type Dialog = 'cancel' | 'no_show' | null;

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Muted>{label}</Muted>
      <Body style={{ fontWeight: '600' }}>{value}</Body>
    </View>
  );
}

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isManager } = useSession();
  const [busy, setBusy] = useState<BookingStatus | 'cancel' | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const booking = useLoad(async () => {
    return unwrap(
      await supabase
        .from('bookings')
        .select(
          'id, starts_at, ends_at, status, price_paise, duration_minutes, customer_notes, cancellation_reason, customer:profiles!bookings_customer_id_fkey (full_name, phone), service:services (name), barber:barbers (display_name)',
        )
        .eq('id', id)
        .maybeSingle(),
    );
  }, [id]);

  if (booking.loading && !booking.data) return <LoadingView />;
  const b = booking.data;
  if (!b) {
    return (
      <Screen onRefresh={booking.refresh} refreshing={booking.refreshing}>
        {booking.error ? (
          <Notice tone="error">{errorMessage(booking.error as { message?: string })}</Notice>
        ) : (
          <EmptyState icon="help-circle-outline" title={t.notFound} />
        )}
      </Screen>
    );
  }

  const started = new Date(b.starts_at) <= new Date();
  const phone = b.customer?.phone ?? null;

  async function setStatus(status: BookingStatus) {
    setBusy(status);
    setError(null);
    const { error: updateError } = await supabase.rpc('update_booking_status', { p_booking_id: b!.id, p_status: status });
    setBusy(null);
    if (updateError) {
      setError(errorMessage(updateError));
      return false;
    }
    await booking.reload();
    return true;
  }

  async function confirmNoShow() {
    if (await setStatus('no_show')) setDialog(null);
  }

  async function cancel() {
    const input = cancelBookingInputSchema.parse({ p_booking_id: b!.id, p_reason: reason.trim() || undefined });
    setBusy('cancel');
    setDialogError(null);
    const { error: cancelError } = await supabase.rpc('cancel_booking', input);
    setBusy(null);
    if (cancelError) {
      setDialogError(errorMessage(cancelError));
      return;
    }
    setDialog(null);
    setReason('');
    await booking.reload();
  }

  const active = b.status === 'pending' || b.status === 'confirmed';

  return (
    <Screen onRefresh={booking.refresh} refreshing={booking.refreshing}>
      <Card>
        <View style={styles.header}>
          <Title style={{ flex: 1 }}>{b.customer?.full_name || t.unnamedCustomer}</Title>
          <StatusBadge status={b.status} />
        </View>
        {phone ? (
          <Button
            label={format(t.call, { phone: formatPhone(phone) })}
            icon="call"
            onPress={() => Linking.openURL(telUrl(phone))}
          />
        ) : (
          <Muted>{t.noPhone}</Muted>
        )}
      </Card>

      <Card>
        <Detail
          label={t.when}
          value={`${formatInAppTimeZone(b.starts_at, { weekday: 'long', day: 'numeric', month: 'long' })}, ${formatTime(b.starts_at)} – ${formatTime(b.ends_at)}`}
        />
        <Detail label={t.service} value={b.service?.name ?? ''} />
        <Detail label={t.barber} value={b.barber?.display_name ?? ''} />
        <Detail label={t.duration} value={formatDuration(b.duration_minutes)} />
        <Detail label={t.price} value={formatPricePaise(b.price_paise)} />
        {b.customer_notes ? <Detail label={t.notes} value={b.customer_notes} /> : null}
        {b.status === 'cancelled' && b.cancellation_reason ? (
          <Muted>{format(t.cancelledBecause, { reason: b.cancellation_reason })}</Muted>
        ) : null}
      </Card>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {/* Actions allowed by update_booking_status: pending -> confirmed; confirmed -> completed /
          no_show once the appointment has started. Cancelling is for owners and managers. */}
      {b.status === 'pending' ? (
        <Button label={t.confirm} icon="checkmark" loading={busy === 'confirmed'} onPress={() => setStatus('confirmed')} />
      ) : null}
      {b.status === 'confirmed' && started ? (
        <>
          <Button label={t.complete} icon="checkmark-done" loading={busy === 'completed'} onPress={() => setStatus('completed')} />
          <Button label={t.noShow} icon="person-remove" variant="secondary" onPress={() => setDialog('no_show')} />
        </>
      ) : null}
      {b.status === 'confirmed' && !started ? (
        <Notice>{format(t.waitUntilStart, { time: formatTime(b.starts_at) })}</Notice>
      ) : null}
      {isManager && active ? (
        <Button label={t.cancel} icon="close-circle" variant="danger" onPress={() => setDialog('cancel')} />
      ) : null}

      <ConfirmDialog
        visible={dialog === 'no_show'}
        title={t.noShowTitle}
        body={t.noShowBody}
        confirmLabel={t.noShowConfirm}
        cancelLabel={t.keep}
        destructive
        loading={busy === 'no_show'}
        error={error}
        onConfirm={confirmNoShow}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'cancel'}
        title={t.cancelTitle}
        body={t.cancelBody}
        confirmLabel={t.cancelConfirm}
        cancelLabel={t.keep}
        destructive
        loading={busy === 'cancel'}
        error={dialogError}
        onConfirm={cancel}
        onCancel={() => {
          setDialog(null);
          setDialogError(null);
        }}>
        <TextField
          label={`${t.reasonLabel} (${m.common.optional})`}
          value={reason}
          onChangeText={setReason}
          placeholder={t.reasonPlaceholder}
          maxLength={500}
        />
      </ConfirmDialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  detail: { gap: 2, paddingVertical: space.xs },
});
