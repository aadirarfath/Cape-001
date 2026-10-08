import { router } from 'expo-router';

import { MenuItem, Screen } from '@/components/ui';
import { m } from '@/i18n';

/** Shop management menu (owners and managers only; see the tabs layout). */
export default function ShopMenuScreen() {
  return (
    <Screen>
      <MenuItem
        icon="people"
        title={m.manage.barbers}
        subtitle={m.manage.barbersHint}
        onPress={() => router.push('/barbers')}
      />
      <MenuItem
        icon="cut"
        title={m.manage.services}
        subtitle={m.manage.servicesHint}
        onPress={() => router.push('/services')}
      />
      <MenuItem
        icon="storefront"
        title={m.manage.settings}
        subtitle={m.manage.settingsHint}
        onPress={() => router.push('/settings')}
      />
      <MenuItem
        icon="images"
        title={m.manage.photos}
        subtitle={m.manage.photosHint}
        onPress={() => router.push('/photos')}
      />
    </Screen>
  );
}
