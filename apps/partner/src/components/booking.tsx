import { formatInAppTimeZone } from '@cape001/core';
import type { Enums } from '@cape001/db';
import { StyleSheet, Text, View } from 'react-native';

import { m } from '@/i18n';
import { font, radius, space, useColors } from '@/theme';

import { Body, Card, Muted } from './ui';

export type BookingStatus = Enums<'booking_status'>;

export function StatusBadge({ status }: { status: BookingStatus }) {
  const colors = useColors();
  const palette: Record<BookingStatus, { bg: string; fg: string }> = {
    pending: { bg: colors.warningBg, fg: colors.warning },
    confirmed: { bg: colors.infoBg, fg: colors.info },
    completed: { bg: colors.successBg, fg: colors.success },
    cancelled: { bg: colors.secondary, fg: colors.muted },
    no_show: { bg: colors.errorBg, fg: colors.danger },
  };
  return (
    <View style={[styles.badge, { backgroundColor: palette[status].bg }]}>
      <Text style={[styles.badgeText, { color: palette[status].fg }]}>{m.status[status]}</Text>
    </View>
  );
}

const timeOnly: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

/** "9:30 am" in India Standard Time. */
export function formatTime(value: string): string {
  return formatInAppTimeZone(value, timeOnly);
}

export interface BookingListItem {
  id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  barberId: string;
  customerName: string | null;
  serviceName: string;
  barberName: string;
}

export function BookingCard({
  booking,
  showBarber,
  onPress,
}: {
  booking: BookingListItem;
  showBarber: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const inactive = booking.status === 'cancelled' || booking.status === 'no_show';
  return (
    <Card onPress={onPress} style={[styles.card, inactive && { opacity: 0.6 }]}>
      <View style={styles.timeColumn}>
        <Text style={[styles.time, { color: colors.text }]}>{formatTime(booking.starts_at)}</Text>
        <Muted style={styles.small}>{formatTime(booking.ends_at)}</Muted>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Body style={{ fontWeight: '600' }} numberOfLines={1}>
          {booking.customerName || m.booking.unnamedCustomer}
        </Body>
        <Muted numberOfLines={1}>{booking.serviceName}</Muted>
        {showBarber ? <Muted numberOfLines={1}>{booking.barberName}</Muted> : null}
      </View>
      <StatusBadge status={booking.status} />
    </Card>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  badgeText: { fontSize: font.small, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  timeColumn: { width: 84 },
  time: { fontSize: font.large, fontWeight: '700' },
  small: { fontSize: font.small },
});
