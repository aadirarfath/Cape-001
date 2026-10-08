import { formatPhone, otpCodeSchema } from '@cape001/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Muted, Notice, Screen, TextField, Title } from '@/components/ui';
import { errorMessage, format, m } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { font, space } from '@/theme';

const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setTimeout(() => setWaitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  async function verify(value: string = code) {
    const parsed = otpCodeSchema.safeParse(value);
    if (!parsed.success || !phone) {
      setFieldError(m.auth.verify.invalidCode);
      return;
    }
    setFieldError(null);
    setError(null);
    setVerifying(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: parsed.data, type: 'sms' });
    setVerifying(false);
    // On success the session changes and the root layout moves on by itself.
    if (verifyError) setError(m.auth.verify.wrongCode);
  }

  async function resend() {
    if (!phone) return;
    setResending(true);
    setError(null);
    setInfo(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    setResending(false);
    if (otpError) {
      setError(errorMessage(otpError));
    } else {
      setInfo(m.auth.verify.codeResent);
      setWaitSeconds(RESEND_SECONDS);
    }
  }

  return (
    <Screen
      footer={
        <Button
          label={verifying ? m.auth.verify.verifying : m.auth.verify.verify}
          icon="log-in"
          loading={verifying}
          onPress={() => verify()}
        />
      }>
      <View style={{ gap: space.sm }}>
        <Title>{m.auth.verify.title}</Title>
        <Body>{format(m.auth.verify.subtitle, { phone: formatPhone(phone ?? '') })}</Body>
      </View>
      <TextField
        label={m.auth.verify.codeLabel}
        value={code}
        onChangeText={(text) => {
          setCode(text);
          // Log in as soon as all 6 digits are typed (or pasted from the SMS).
          if (/^\d{6}$/.test(text.replace(/\s/g, ''))) verify(text);
        }}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={7}
        autoFocus
        style={{ fontSize: font.huge, letterSpacing: 8 }}
        error={fieldError}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {info ? <Notice tone="success">{info}</Notice> : null}
      {waitSeconds > 0 ? (
        <Muted>{format(m.auth.verify.resendIn, { seconds: waitSeconds })}</Muted>
      ) : (
        <Button label={m.auth.verify.resend} variant="secondary" icon="refresh" loading={resending} onPress={resend} />
      )}
      <Button label={m.auth.verify.changeNumber} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
