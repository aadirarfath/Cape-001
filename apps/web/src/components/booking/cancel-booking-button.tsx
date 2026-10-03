"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cancelBooking } from "@/app/actions/booking";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/provider";
import type { DbErrorCode } from "@cape001/core";

/** Two-tap cancel ("Cancel booking" → "Yes, cancel"). The cutoff is enforced by cancel_booking. */
export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const m = useMessages();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancel() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await cancelBooking({ p_booking_id: bookingId });
        if (result.ok) {
          setConfirming(false);
          router.refresh();
          return;
        }
        const code = result.code;
        setError(code in m.errors.codes ? m.errors.codes[code as DbErrorCode] : m.errors.generic);
        router.refresh(); // e.g. the cutoff just passed: re-render without the button
      } catch {
        setError(m.errors.generic);
      }
    });
  }

  return (
    <div className="space-y-2">
      {!confirming ? (
        <Button variant="destructive" className="w-full" onClick={() => setConfirming(true)}>
          {m.bookings.cancel}
        </Button>
      ) : (
        <div className="space-y-2 rounded-lg border p-3" role="group" aria-label={m.bookings.cancelConfirm}>
          <p className="text-sm font-medium">{m.bookings.cancelConfirm}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              {m.bookings.cancelNo}
            </Button>
            <Button variant="destructive" onClick={cancel} disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {pending ? m.bookings.cancelling : m.bookings.cancelYes}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
