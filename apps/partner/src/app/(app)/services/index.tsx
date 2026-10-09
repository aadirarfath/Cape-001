import { formatPricePaise } from '@cape001/core';
import { router } from 'expo-router';

import { Button, EmptyState, LoadingView, MenuItem, Notice, Screen } from '@/components/ui';
import { errorMessage, formatDuration, m } from '@/i18n';
import { useShop } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { unwrap, useLoad } from '@/lib/use-load';

const t = m.services;

export default function ServicesScreen() {
  const shop = useShop();
  const services = useLoad(async () => {
    return unwrap(
      await supabase
        .from('services')
        .select('id, name, duration_minutes, price_paise, is_active')
        .eq('shop_id', shop.id)
        .order('is_active', { ascending: false })
        .order('sort_order')
        .order('name'),
    );
  }, [shop.id]);

  if (services.loading && !services.data) return <LoadingView />;

  return (
    <Screen
      onRefresh={services.refresh}
      refreshing={services.refreshing}
      footer={<Button label={t.add} icon="add" onPress={() => router.push({ pathname: '/services/[id]', params: { id: 'new' } })} />}>
      {services.error ? <Notice tone="error">{errorMessage(services.error as { message?: string })}</Notice> : null}
      {services.data?.length === 0 ? <EmptyState icon="cut-outline" title={t.empty} /> : null}
      {services.data?.map((s) => (
        <MenuItem
          key={s.id}
          icon={s.is_active ? 'cut' : 'eye-off'}
          title={s.name}
          subtitle={[formatPricePaise(s.price_paise), formatDuration(s.duration_minutes), s.is_active ? null : t.inactive]
            .filter(Boolean)
            .join(' · ')}
          onPress={() => router.push({ pathname: '/services/[id]', params: { id: s.id } })}
        />
      ))}
    </Screen>
  );
}
