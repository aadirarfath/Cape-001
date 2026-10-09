import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { BookingFlow } from "@/components/booking/booking-flow";
import { format, getMessages } from "@/i18n";
import { getShopBySlug } from "@/lib/shops";
import { createClient, getUserId } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  const m = getMessages();
  return {
    title: shop ? format(m.booking.title, { shop: shop.name }) : m.shop.notFound,
    robots: { index: false, follow: false },
  };
}

export default async function BookPage({ params }: { params: Params }) {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const m = getMessages();
  const supabase = await createClient();
  const userId = await getUserId(supabase);

  let needsName = false;
  if (userId) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    needsName = !profile?.full_name?.trim();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link
          href={`/shops/${shop.slug}`}
          className="-ml-1 inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {shop.name}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{format(m.booking.title, { shop: shop.name })}</h1>
      </div>
      <Suspense>
        <BookingFlow
          shop={{ id: shop.id, name: shop.name, maxDaysAhead: shop.max_days_ahead }}
          services={shop.services}
          barbers={shop.barbers}
          barberServices={shop.barberServices}
          isLoggedIn={userId !== null}
          needsName={needsName}
        />
      </Suspense>
    </div>
  );
}
