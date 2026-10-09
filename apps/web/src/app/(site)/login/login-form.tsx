"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PhoneOtpForm } from "@/components/auth/phone-otp-form";
import { safeNextPath } from "@/lib/redirect";

export function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));

  return (
    <PhoneOtpForm
      onVerified={() => {
        router.replace(next);
        router.refresh();
      }}
    />
  );
}
