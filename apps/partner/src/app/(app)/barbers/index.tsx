import { formatPhone } from '@cape001/core';
import { router } from 'expo-router';

import { Button, EmptyState, LoadingView, MenuItem, Notice, Screen } from '@/components/ui';
import { errorMessage, format, m } from '@/i18n';
import { useShop } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { unwrap, useLoad } from '@/lib/use-load';

const t = m.barbers;

export default function BarbersScreen() {
  const shop = useShop();
  const barbers = useLoad(async () => {
    const [rows, invites] = await Promise.all([
      supabase
        .from('barbers')
        .select('id, display_name, is_active, user_id')
        .eq('shop_id', shop.id)
        .order('is_active', { ascending: false })
        .order('sort_order')
        .order('display_name'),
      supabase.from('barber_invites').select('barber_id, phone').eq('shop_id', shop.id),
    ]);
    const invitePhone = new Map(unwrap(invites).map((i) => [i.barber_id, i.phone]));
    return unwrap(rows).map((b) => ({ ...b, invitePhone: invitePhone.get(b.id) ?? null }));
  }, [shop.id]);

  if (barbers.loading && !barbers.data) return <LoadingView />;

  return (
    <Screen
      onRefresh={barbers.refresh}
      refreshing={barbers.refreshing}
      footer={<Button label={t.add} icon="person-add" onPress={() => router.push({ pathname: '/barbers/[id]', params: { id: 'new' } })} />}>
      {barbers.error ? <Notice tone="error">{errorMessage(barbers.error as { message?: string })}</Notice> : null}
      {barbers.data?.length === 0 ? <EmptyState icon="people-outline" title={t.empty} /> : null}
      {barbers.data?.map((b) => (
        <MenuItem
          key={b.id}
          icon={b.is_active ? 'person' : 'person-outline'}
          title={b.display_name}
          subtitle={[
            !b.is_active ? t.inactive : null,
            b.user_id ? t.linked : b.invitePhone ? format(t.invited, { phone: formatPhone(b.invitePhone) }) : t.noLogin,
          ]
            .filter(Boolean)
            .join(' · ')}
          onPress={() => router.push({ pathname: '/barbers/[id]', params: { id: b.id } })}
        />
      ))}
    </Screen>
  );
}
