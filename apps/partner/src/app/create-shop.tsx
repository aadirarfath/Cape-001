import {
  createShopInputSchema,
  formatPhone,
  getDbErrorCode,
  KOCHI_AREAS,
  pinCodeSchema,
  slugify,
  slugWithSuffix,
} from '@cape001/core';
import { useState } from 'react';

import { type Coordinates, LocationCapture } from '@/components/location-capture';
import { Body, Button, Card, Chip, ChipRow, Label, Muted, Notice, Screen, Section, TextField } from '@/components/ui';
import { errorMessage, m } from '@/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const t = m.onboarding.createShop;

type Field = 'name' | 'address' | 'pin' | 'location';

export default function CreateShopScreen() {
  const { profile, refresh } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(profile?.phone ? formatPhone(profile.phone) : '');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('Kochi');
  const [pin, setPin] = useState('');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  async function create() {
    const errors: Partial<Record<Field, string>> = {};
    if (name.trim().length < 2) errors.name = m.errors.required;
    if (address.trim().length < 3) errors.address = m.errors.required;
    if (pin.trim() && !pinCodeSchema.safeParse(pin.trim()).success) errors.pin = t.invalidPin;
    if (!location) errors.location = m.location.needed;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !location) return;

    const baseSlug = slugify(name, area);
    const input = createShopInputSchema.safeParse({
      p_name: name,
      p_slug: baseSlug,
      p_lng: location.lng,
      p_lat: location.lat,
      p_address_line: address,
      p_area: area.trim() || undefined,
      p_city: city.trim() || undefined,
      p_postal_code: pin.trim() || undefined,
      p_phone: phone.trim() || undefined,
    });
    if (!input.success) {
      setError(m.errors.generic);
      return;
    }

    setError(null);
    setCreating(true);
    // The slug is only the website address; if it is taken, add a short random ending.
    let slug = baseSlug;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { error: createError } = await supabase.rpc('create_shop', { ...input.data, p_slug: slug });
      if (!createError) {
        await refresh().catch(() => {});
        setCreating(false);
        return; // the root layout moves on to "Waiting for approval"
      }
      if (getDbErrorCode(createError) !== 'SLUG_TAKEN') {
        setError(errorMessage(createError));
        break;
      }
      slug = slugWithSuffix(baseSlug);
    }
    setCreating(false);
  }

  async function checkInvite() {
    setChecking(true);
    setInviteMessage(null);
    try {
      await refresh(); // claims invites; if one matched, the root layout opens the shop
      setInviteMessage(t.noInvite);
    } catch (e) {
      setInviteMessage(errorMessage(e as { message?: string }));
    } finally {
      setChecking(false);
    }
  }

  return (
    <Screen footer={<Button label={creating ? t.creating : t.create} icon="storefront" loading={creating} onPress={create} />}>
      <Body>{t.subtitle}</Body>

      <Section>
        <TextField
          label={t.shopName}
          value={name}
          onChangeText={setName}
          placeholder={t.shopNamePlaceholder}
          autoCapitalize="words"
          maxLength={100}
          error={fieldErrors.name}
        />
        <TextField
          label={t.shopPhone}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={20}
        />
        <TextField
          label={t.address}
          value={address}
          onChangeText={setAddress}
          placeholder={t.addressPlaceholder}
          maxLength={200}
          error={fieldErrors.address}
        />
        <Label>{t.area}</Label>
        <ChipRow>
          {KOCHI_AREAS.map((a) => (
            <Chip key={a.id} label={m.areas[a.id]} selected={area === m.areas[a.id]} onPress={() => setArea(m.areas[a.id])} />
          ))}
        </ChipRow>
        <TextField label={`${t.area} (${m.common.optional})`} value={area} onChangeText={setArea} maxLength={100} />
        <TextField label={t.city} value={city} onChangeText={setCity} maxLength={100} />
        <TextField
          label={`${t.pin} (${m.common.optional})`}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          maxLength={6}
          error={fieldErrors.pin}
        />
      </Section>

      <Section title={t.locationTitle}>
        <Muted>{t.locationHint}</Muted>
        <LocationCapture value={location} onChange={setLocation} />
        {fieldErrors.location ? <Notice tone="error">{fieldErrors.location}</Notice> : null}
      </Section>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <Card>
        <Label>{t.invitedTitle}</Label>
        <Muted>{t.invitedBody}</Muted>
        <Button label={t.checkInvite} variant="secondary" icon="people" loading={checking} onPress={checkInvite} />
        {inviteMessage ? <Notice>{inviteMessage}</Notice> : null}
      </Card>
    </Screen>
  );
}
