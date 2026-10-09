import { indianMobileSchema } from '@cape001/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Notice, Screen, TextField, Title } from '@/components/ui';
import { errorMessage, m } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { space } from '@/theme';

export default function LoginScreen() {
  const [phoneText, setPhoneText] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendCode() {
    const parsed = indianMobileSchema.safeParse(phoneText);
    if (!parsed.success) {
      setFieldError(m.auth.login.invalidPhone);
      return;
    }
    setFieldError(null);
    setError(null);
    setSending(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: parsed.data });
    setSending(false);
    if (otpError) {
      setError(errorMessage(otpError));
      return;
    }
    router.push({ pathname: '/verify', params: { phone: parsed.data } });
  }

  return (
    <Screen
      footer={
        <Button
          label={sending ? m.auth.login.sending : m.auth.login.sendCode}
          icon="chatbubble-ellipses"
          loading={sending}
          onPress={sendCode}
        />
      }>
      <View style={{ gap: space.sm, marginTop: space.xxl }}>
        <Title>{m.auth.login.title}</Title>
        <Body>{m.auth.login.subtitle}</Body>
      </View>
      <TextField
        label={m.auth.login.phoneLabel}
        prefix="+91"
        value={phoneText}
        onChangeText={setPhoneText}
        placeholder={m.auth.login.phonePlaceholder}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={16}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={sendCode}
        error={fieldError}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Screen>
  );
}
