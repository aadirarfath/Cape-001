import { fullNameSchema } from '@cape001/core';
import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Notice, Screen, TextField, Title } from '@/components/ui';
import { errorMessage, m } from '@/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { space } from '@/theme';

export default function YourNameScreen() {
  const { refresh } = useSession();
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = fullNameSchema.safeParse(name);
    if (!parsed.success) {
      setFieldError(m.errors.codes.INVALID_NAME);
      return;
    }
    setFieldError(null);
    setError(null);
    setSaving(true);
    const { error: saveError } = await supabase.rpc('update_my_profile', { p_full_name: parsed.data });
    if (saveError) {
      setSaving(false);
      setError(errorMessage(saveError));
      return;
    }
    // The root layout moves on once the profile has a name.
    await refresh().catch(() => {});
    setSaving(false);
  }

  return (
    <Screen footer={<Button label={m.common.continue} icon="arrow-forward" loading={saving} onPress={save} />}>
      <View style={{ gap: space.sm, marginTop: space.xxl }}>
        <Title>{m.onboarding.name.title}</Title>
        <Body>{m.onboarding.name.subtitle}</Body>
      </View>
      <TextField
        label={m.onboarding.name.label}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        autoFocus
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={save}
        error={fieldError}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Screen>
  );
}
