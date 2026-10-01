import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleCheck, MapPin, Phone } from "lucide-react";
import { formatInAppTimeZone, formatPricePaise, isBeforeCancellationCutoff, uuidSchema } from "@cape001/core";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";
import { StatusBadge } from "@/components/booking/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { format, getMessages } from "@/i18n";
import { getMyBooking, isUpcoming } from "@/lib/bookings";
import { loginUrl } from "@/lib/redirect";
import { mapsSearchUrl } from "@/lib/shops";
import { createClient, getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: getMessages().confirmation.detailsTitle,
  robots: { index: false, follow: false },
};

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ id }, { new: isNew }] = await Promise.all([params, searchParams]);
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  if (!(await getUserId(supabase))) redirect(loginUrl(`/bookings/${id}`));

  const booking = await getMyBooking(supabase, id);
  if (!booking) notFound();

  const m = getMessages();
  const locale = m.meta.intlLocale;
  const when = formatInAppTimeZone(
    booking.starts_at,
    { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" },
    locale,
  );
  const shop = booking.shop;
  const upcoming = isUpcoming(booking);
  const cutoffMinutes = shop?.cancellation_cutoff_minutes ?? 0;
  const canCancel = upcoming && isBeforeCancellationCutoff(booking.starts_at, cutoffMinutes);
  const cutoffTime = formatInAppTimeZone(
    new Date(new Date(booking.starts_at).getTime() - cutoffMinutes * 60_000),
    { weekday: "short", hour: "numeric", minute: "2-digit" },
    locale,
  );

  return (
    <div className="space-y-6">
      {isNew === "1" && booking.status === "confirmed" ? (
        <div className="space-y-2 pt-2 text-center">
          <CircleCheck className="mx-auto size-12 text-green-600" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">{m.confirmation.title}</h1>
          {shop && <p className="text-muted-foreground">{format(m.confirmation.subtitle, { shop: shop.name })}</p>}
        </div>
      ) : (
        <h1 className="text-2xl font-bold tracking-tight">{m.confirmation.detailsTitle}</h1>
      )}

      <dl className="divide-y rounded-xl border">
        <Row label={m.booking.summary.when} value={when} />
        <Row label={m.booking.summary.service} value={`${booking.service?.name ?? ""} · ${format(m.shop.minutes, { count: booking.duration_minutes })}`} />
        {booking.barber && <Row label={m.booking.summary.barber} value={booking.barber.display_name} />}
        <Row label={m.booking.summary.price} value={formatPricePaise(booking.price_paise, locale)} />
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-sm text-muted-foreground">{m.confirmation.status}</dt>
          <dd>
            <StatusBadge status={booking.status} m={m} />
          </dd>
        </div>
        {booking.customer_notes && <Row label={m.confirmation.notes} value={booking.customer_notes} />}
        <Row label={m.confirmation.bookingId} value={booking.id.slice(0, 8).toUpperCase()} />
      </dl>

      {shop && (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="font-semibold">
            <Link href={`/shops/${shop.slug}`} className="hover:underline">
              {shop.name}
            </Link>
          </h2>
          <p className="flex gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            {[shop.address_line, shop.area, shop.city].filter(Boolean).join(", ")}
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={mapsSearchUrl(shop)} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <MapPin aria-hidden />
              {m.shop.openInMaps}
            </a>
            {shop.phone && (
              <a href={`tel:${shop.phone.replace(/\s/g, "")}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Phone aria-hidden />
                {format(m.shop.call, { phone: shop.phone })}
              </a>
            )}
          </div>
        </section>
      )}

      {upcoming && (
        <div className="space-y-2">
          {canCancel ? (
            <>
              <p className="text-sm text-muted-foreground">{format(m.confirmation.cancelHint, { time: cutoffTime })}</p>
              <CancelBookingButton bookingId={booking.id} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{format(m.confirmation.cancelClosed, { time: cutoffTime })}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Link href="/bookings" className={buttonVariants({ variant: "outline", className: "w-full" })}>
          {m.confirmation.viewAll}
        </Link>
        {shop && (
          <Link href={`/shops/${shop.slug}/book`} className={buttonVariants({ variant: "ghost", className: "w-full" })}>
            {m.confirmation.bookAnother}
          </Link>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
