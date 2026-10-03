import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { formatInAppTimeZone, formatPricePaise } from "@cape001/core";
import { LogoutButton } from "@/components/auth/logout-button";
import { StatusBadge } from "@/components/booking/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMessages, type Messages } from "@/i18n";
import { getMyBookings, isUpcoming, type MyBooking } from "@/lib/bookings";
import { loginUrl } from "@/lib/redirect";
import { createClient, getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: getMessages().bookings.title,
  robots: { index: false, follow: false },
};

export default async function MyBookingsPage() {
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect(loginUrl("/bookings"));

  const m = getMessages();
  const bookings = await getMyBookings(supabase, userId);
  const now = new Date();
  // Upcoming: soonest first. Past (and cancelled): most recent first, as fetched.
  const upcoming = bookings.filter((b) => isUpcoming(b, now)).reverse();
  const past = bookings.filter((b) => !isUpcoming(b, now));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{m.bookings.title}</h1>
        <LogoutButton />
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList className="w-full">
          <TabsTrigger value="upcoming">
            {m.bookings.upcoming} ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="past">{m.bookings.past}</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="pt-2">
          <BookingList bookings={upcoming} empty={m.bookings.noUpcoming} m={m} showFindShop />
        </TabsContent>
        <TabsContent value="past" className="pt-2">
          <BookingList bookings={past} empty={m.bookings.noPast} m={m} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookingList({
  bookings,
  empty,
  m,
  showFindShop = false,
}: {
  bookings: MyBooking[];
  empty: string;
  m: Messages;
  showFindShop?: boolean;
}) {
  const locale = m.meta.intlLocale;

  if (bookings.length === 0) {
    return (
      <div className="space-y-4 rounded-xl border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">{empty}</p>
        {showFindShop && (
          <Link href="/" className={buttonVariants()}>
            {m.bookings.findShop}
          </Link>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <Link
            href={`/bookings/${booking.id}`}
            className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50"
            aria-label={`${m.bookings.details}: ${booking.shop?.name ?? ""}`}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold">{booking.shop?.name}</p>
                <StatusBadge status={booking.status} m={m} />
              </div>
              <p className="text-sm">
                {formatInAppTimeZone(
                  booking.starts_at,
                  { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
                  locale,
                )}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {[booking.service?.name, booking.barber?.display_name, formatPricePaise(booking.price_paise, locale)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
