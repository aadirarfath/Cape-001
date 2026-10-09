"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  bookableDates,
  formatInAppTimeZone,
  formatLocalDate,
  formatPricePaise,
  fullNameSchema,
  getAvailableSlotsAnyInputSchema,
  getAvailableSlotsInputSchema,
  getDbErrorCode,
  localDateOf,
  timestamptzSchema,
  type DbErrorCode,
} from "@cape001/core";
import { Check, Clock, Loader2, Users } from "lucide-react";
import { confirmBooking } from "@/app/actions/booking";
import { PhoneOtpForm } from "@/components/auth/phone-otp-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { format, type Messages } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export type BookingFlowProps = {
  shop: { id: string; name: string; maxDaysAhead: number };
  services: { id: string; name: string; duration_minutes: number; price_paise: number }[];
  barbers: { id: string; display_name: string }[];
  barberServices: { barber_id: string; service_id: string }[];
  isLoggedIn: boolean;
  needsName: boolean;
};

type Slot = { starts_at: string; ends_at: string };
type SlotsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; slots: Slot[] };

const ANY = "any";

/** Booking errors that mean "pick a different time": send the customer back to the slot list. */
const PICK_ANOTHER_TIME: readonly DbErrorCode[] = [
  "SLOT_TAKEN",
  "BARBER_UNAVAILABLE",
  "SLOT_IN_PAST",
  "OUTSIDE_WORKING_HOURS",
  "INVALID_TIME",
  "TOO_FAR_AHEAD",
];

function istHour(iso: string): number {
  return Number(formatInAppTimeZone(iso, { hour: "numeric", hourCycle: "h23" }, "en-GB"));
}

export function BookingFlow({ shop, services, barbers, barberServices, isLoggedIn, needsName }: BookingFlowProps) {
  const m = useMessages();
  const locale = m.meta.intlLocale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // --- Selection, kept in the URL so back/refresh/login keep the customer's place -------------
  const dates = useMemo(() => bookableDates(shop.maxDaysAhead), [shop.maxDaysAhead]);

  const service = services.find((s) => s.id === searchParams.get("service"));
  const eligibleBarbers = useMemo(
    () =>
      service
        ? barbers.filter((b) => barberServices.some((bs) => bs.barber_id === b.id && bs.service_id === service.id))
        : [],
    [service, barbers, barberServices],
  );
  const barberParam = searchParams.get("barber");
  const barber = service
    ? barberParam === ANY && eligibleBarbers.length > 0
      ? ANY
      : eligibleBarbers.find((b) => b.id === barberParam)
    : undefined;
  const date = barber ? dates.find((d) => d === searchParams.get("date")) : undefined;
  const slotParse = timestamptzSchema.safeParse(searchParams.get("slot"));
  // The slot must fall on the chosen local date; anything else in the URL is ignored.
  const slotParam =
    date && slotParse.success && localDateOf(slotParse.data) === date ? slotParse.data : null;

  const step = !service ? "service" : !barber ? "barber" : !date ? "date" : !slotParam ? "slot" : "confirm";

  const setParams = useCallback(
    (changes: Record<string, string | null>, mode: "push" | "replace" = "push") => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const url = `${pathname}?${next.toString()}`;
      // Shallow update: the native history API changes the URL (and useSearchParams) without a
      // server round trip. router.push would re-render the page on the server for every tap.
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [pathname, searchParams],
  );

  // --- Free slots ----------------------------------------------------------------------------
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // The last finished request. Loading/idle are derived: a result for another key is stale.
  const [slotsResult, setSlotsResult] = useState<{ key: string; slots: Slot[] | null } | null>(null);

  const serviceId = service?.id;
  const barberId = barber === ANY ? ANY : barber?.id;
  const slotsKey = serviceId && barberId && date ? `${serviceId}|${barberId}|${date}|${slotsVersion}` : null;
  const slotsState: SlotsState = !slotsKey
    ? { status: "idle" }
    : slotsResult?.key !== slotsKey
      ? { status: "loading" }
      : slotsResult.slots
        ? { status: "ready", slots: slotsResult.slots }
        : { status: "error" };

  useEffect(() => {
    if (!slotsKey || !serviceId || !barberId || !date) return;
    let cancelled = false;

    const supabase = createClient();
    const request =
      barberId === ANY
        ? supabase.rpc(
            "get_available_slots_any",
            getAvailableSlotsAnyInputSchema.parse({ p_shop_id: shop.id, p_service_id: serviceId, p_date: date }),
          )
        : supabase.rpc(
            "get_available_slots",
            getAvailableSlotsInputSchema.parse({ p_barber_id: barberId, p_service_id: serviceId, p_date: date }),
          );

    request.then(({ data, error }) => {
      if (!cancelled) setSlotsResult({ key: slotsKey, slots: error ? null : data });
    });
    return () => {
      cancelled = true;
    };
  }, [shop.id, serviceId, barberId, date, slotsKey]);

  // --- Confirm -------------------------------------------------------------------------------
  const [notes, setNotes] = useState("");
  const [fullName, setFullName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitting, startSubmitting] = useTransition();

  function backToSlots(message: string) {
    setNotice(message);
    setSlotsVersion((v) => v + 1); // refetch the latest free slots
    setParams({ slot: null }, "replace");
  }

  function handleConfirm() {
    if (!service || !barber || !slotParam) return;
    setConfirmError(null);
    setNameError(null);

    let name: string | undefined;
    if (needsName) {
      const parsed = fullNameSchema.safeParse(fullName);
      if (!parsed.success) {
        setNameError(m.errors.invalidName);
        return;
      }
      name = parsed.data;
    }

    const trimmedNotes = notes.trim() || undefined;
    startSubmitting(async () => {
      let result: Awaited<ReturnType<typeof confirmBooking>>;
      try {
        result = await confirmBooking({
          ...(barber === ANY
            ? {
                barber: "any" as const,
                input: { p_shop_id: shop.id, p_service_id: service.id, p_starts_at: slotParam, p_customer_notes: trimmedNotes },
              }
            : {
                barber: "specific" as const,
                input: { p_barber_id: barber.id, p_service_id: service.id, p_starts_at: slotParam, p_customer_notes: trimmedNotes },
              }),
          fullName: name,
        });
      } catch {
        setConfirmError(navigator.onLine ? m.errors.generic : m.errors.network);
        return;
      }

      if (result.ok) {
        router.push(`/bookings/${result.data.bookingId}?new=1`);
        return;
      }

      const code = result.code;
      if (code === "SLOT_TAKEN") return backToSlots(m.booking.slotTaken);
      if (PICK_ANOTHER_TIME.includes(code as DbErrorCode)) return backToSlots(m.errors.codes[code as DbErrorCode]);
      if (code === "INVALID_NAME") return setNameError(m.errors.invalidName);
      if (code === "NOT_AUTHENTICATED") router.refresh(); // session expired: show the login form again
      setConfirmError(getDbErrorCode({ message: code }) ? m.errors.codes[code as DbErrorCode] : m.errors.generic);
    });
  }

  // --- Render --------------------------------------------------------------------------------
  const barberLabel = barber === ANY ? m.booking.anyBarber : barber?.display_name;

  return (
    <div className="space-y-6">
      {/* Choices so far, each with a way back */}
      {service && (
        <dl className="divide-y rounded-xl border text-sm">
          <SummaryRow
            label={m.booking.summary.service}
            value={`${service.name} · ${format(m.shop.minutes, { count: service.duration_minutes })} · ${formatPricePaise(service.price_paise, locale)}`}
            changeLabel={m.booking.change}
            onChange={() => setParams({ service: null, barber: null, date: null, slot: null })}
          />
          {barberLabel && (
            <SummaryRow
              label={m.booking.summary.barber}
              value={barberLabel}
              changeLabel={m.booking.change}
              onChange={() => setParams({ barber: null, date: null, slot: null })}
            />
          )}
          {date && (
            <SummaryRow
              label={m.booking.summary.when}
              value={
                slotParam
                  ? formatInAppTimeZone(slotParam, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }, locale)
                  : formatLocalDate(date, undefined, locale)
              }
              changeLabel={m.booking.change}
              onChange={() => setParams({ date: null, slot: null })}
            />
          )}
        </dl>
      )}

      {step === "service" && (
        <Step title={m.booking.steps.service}>
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id}>
                <ChoiceButton onClick={() => setParams({ service: s.id })}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.name}</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="size-3.5" aria-hidden />
                      {format(m.shop.minutes, { count: s.duration_minutes })}
                    </span>
                  </span>
                  <span className="font-semibold">{formatPricePaise(s.price_paise, locale)}</span>
                </ChoiceButton>
              </li>
            ))}
          </ul>
        </Step>
      )}

      {step === "barber" && (
        <Step title={m.booking.steps.barber}>
          <ul className="space-y-2">
            {eligibleBarbers.length > 1 && (
              <li>
                <ChoiceButton onClick={() => setParams({ barber: ANY })}>
                  <Users className="size-5 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{m.booking.anyBarber}</span>
                    <span className="text-sm text-muted-foreground">{m.booking.anyBarberHint}</span>
                  </span>
                </ChoiceButton>
              </li>
            )}
            {eligibleBarbers.map((b) => (
              <li key={b.id}>
                <ChoiceButton onClick={() => setParams({ barber: b.id })}>
                  <span
                    aria-hidden
                    className="flex size-9 items-center justify-center rounded-full bg-muted font-semibold"
                  >
                    {b.display_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 font-medium">{b.display_name}</span>
                </ChoiceButton>
              </li>
            ))}
          </ul>
        </Step>
      )}

      {step === "date" && (
        <Step title={m.booking.steps.date}>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {dates.map((d, index) => (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setParams({ date: d });
                  }}
                  className="flex h-16 w-full flex-col items-center justify-center rounded-lg border text-sm transition-colors hover:bg-muted"
                >
                  <span className="text-xs text-muted-foreground">
                    {index === 0
                      ? m.booking.today
                      : index === 1
                        ? m.booking.tomorrow
                        : formatLocalDate(d, { weekday: "short" }, locale)}
                  </span>
                  <span className="font-semibold">{formatLocalDate(d, { day: "numeric", month: "short" }, locale)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Step>
      )}

      {step === "slot" && (
        <Step title={m.booking.steps.slot}>
          {notice && (
            <Alert variant="destructive" role="alert" className="mb-4">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          <SlotGrid
            state={slotsState}
            m={m}
            locale={locale}
            onPick={(slot) => {
              setNotice(null);
              setParams({ slot: slot.starts_at });
            }}
            onRetry={() => setSlotsVersion((v) => v + 1)}
          />
        </Step>
      )}

      {step === "confirm" && service && (
        <Step title={m.booking.steps.confirm}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{m.booking.payAtShop}</p>

            {!isLoggedIn ? (
              <div className="space-y-3 rounded-xl border p-4">
                <h3 className="font-medium">{m.booking.loginToConfirm}</h3>
                <PhoneOtpForm onVerified={() => router.refresh()} />
              </div>
            ) : (
              <>
                {needsName && (
                  <div className="space-y-1.5">
                    <Label htmlFor="full-name">{m.booking.nameLabel}</Label>
                    <Input
                      id="full-name"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      maxLength={60}
                      aria-invalid={nameError ? true : undefined}
                      aria-describedby="full-name-hint"
                      className="h-11 text-base"
                    />
                    <p id="full-name-hint" className={cn("text-sm", nameError ? "text-destructive" : "text-muted-foreground")}>
                      {nameError ?? m.booking.nameHint}
                    </p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="notes">{m.booking.notesLabel}</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={m.booking.notesPlaceholder}
                    maxLength={500}
                    rows={2}
                    className="text-base"
                  />
                </div>
                {confirmError && (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{confirmError}</AlertDescription>
                  </Alert>
                )}
                <Button size="lg" className="h-12 w-full text-base" onClick={handleConfirm} disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                  {submitting ? m.booking.confirming : m.booking.confirm}
                </Button>
              </>
            )}
          </div>
        </Step>
      )}
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ChoiceButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"
    >
      {children}
    </button>
  );
}

function SummaryRow({
  label,
  value,
  changeLabel,
  onChange,
}: {
  label: string;
  value: string;
  changeLabel: string;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium">{value}</dd>
      </div>
      <Button variant="ghost" size="sm" onClick={onChange} aria-label={`${changeLabel}: ${label}`}>
        {changeLabel}
      </Button>
    </div>
  );
}

function SlotGrid({
  state,
  m,
  locale,
  onPick,
  onRetry,
}: {
  state: SlotsState;
  m: Messages;
  locale: string;
  onPick: (slot: Slot) => void;
  onRetry: () => void;
}) {
  if (state.status === "idle" || state.status === "loading") {
    return (
      <div aria-busy="true" aria-label={m.booking.loadingSlots} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-11" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{m.booking.slotsError}</p>
        <Button variant="outline" onClick={onRetry}>
          {m.booking.retry}
        </Button>
      </div>
    );
  }

  if (state.slots.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{m.booking.noSlots}</p>;
  }

  const groups = [
    { label: m.booking.morning, slots: state.slots.filter((s) => istHour(s.starts_at) < 12) },
    { label: m.booking.afternoon, slots: state.slots.filter((s) => istHour(s.starts_at) >= 12 && istHour(s.starts_at) < 17) },
    { label: m.booking.evening, slots: state.slots.filter((s) => istHour(s.starts_at) >= 17) },
  ].filter((g) => g.slots.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">{group.label}</h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {group.slots.map((slot) => (
              <li key={slot.starts_at}>
                <button
                  type="button"
                  onClick={() => onPick(slot)}
                  className="h-11 w-full rounded-lg border text-sm font-medium transition-colors hover:bg-muted"
                >
                  {formatInAppTimeZone(slot.starts_at, { hour: "numeric", minute: "2-digit" }, locale)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
