"use client";

import { useEffect, useState } from "react";
import { indianMobileSchema, otpCodeSchema } from "@cape001/core";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/browser";

const RESEND_AFTER_SECONDS = 30;

/** Phone number + SMS code sign-in (Supabase Auth). Calls onVerified once the session is set. */
export function PhoneOtpForm({ onVerified }: { onVerified: () => void }) {
  const m = useMessages();
  const [phoneText, setPhoneText] = useState("");
  const [phone, setPhone] = useState<string | null>(null); // E.164, once the code is sent
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode(e164: string) {
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({ phone: e164 });
    setPending(false);
    if (error) {
      setError(error.status === 429 ? m.auth.tooManyRequests : m.auth.sendFailed);
      return;
    }
    setPhone(e164);
    setCode("");
    setResendIn(RESEND_AFTER_SECONDS);
  }

  async function onSubmitPhone(event: React.FormEvent) {
    event.preventDefault();
    const parsed = indianMobileSchema.safeParse(phoneText);
    if (!parsed.success) {
      setError(m.auth.invalidPhone);
      return;
    }
    await sendCode(parsed.data);
  }

  async function verify(value: string) {
    if (!phone) return;
    const parsed = otpCodeSchema.safeParse(value);
    if (!parsed.success) {
      setError(m.auth.invalidCode);
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ phone, token: parsed.data, type: "sms" });
    setPending(false);
    if (error) {
      setError(error.status === 429 ? m.auth.tooManyRequests : m.auth.wrongCode);
      setCode("");
      return;
    }
    onVerified();
  }

  if (!phone) {
    return (
      <form onSubmit={onSubmitPhone} className="space-y-3" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="phone">{m.auth.phoneLabel}</Label>
          <div className="flex items-center gap-2">
            <span className="flex h-11 items-center rounded-lg border bg-muted px-3 text-sm">{m.auth.phonePrefix}</span>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder={m.auth.phonePlaceholder}
              value={phoneText}
              onChange={(e) => setPhoneText(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "phone-error" : undefined}
              className="h-11 text-base"
              maxLength={16}
            />
          </div>
        </div>
        {error && (
          <Alert variant="destructive" id="phone-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? m.auth.sending : m.auth.sendCode}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void verify(code);
      }}
      className="space-y-3"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="otp">{format(m.auth.codeSentTo, { phone: `+91 ${phone.slice(3, 8)} ${phone.slice(8)}` })}</Label>
        <InputOTP
          id="otp"
          maxLength={6}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="^[0-9]*$"
          value={code}
          onChange={setCode}
          onComplete={(value: string) => void verify(value)}
          disabled={pending}
          aria-label={m.auth.codeLabel}
          autoFocus
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, i) => (
              <InputOTPSlot key={i} index={i} className="size-11 text-lg" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending || code.length !== 6}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? m.auth.verifying : m.auth.verify}
      </Button>
      <div className="flex justify-between">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          onClick={() => {
            setPhone(null);
            setError(null);
          }}
        >
          {m.auth.changeNumber}
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          disabled={pending || resendIn > 0}
          onClick={() => void sendCode(phone)}
        >
          {resendIn > 0 ? `${m.auth.resend} (${resendIn})` : m.auth.resend}
        </Button>
      </div>
    </form>
  );
}
