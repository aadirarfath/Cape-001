import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { findLegacyKochiArea, findZone, formatDistance, formatPricePaise, nearbyShopsInputSchema } from "@cape001/core";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { format, getMessages } from "@/i18n";
import { searchNearbyShops } from "@/lib/shops";

const RADII_M = [5_000, 15_000, 50_000] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: getMessages().results.title,
  robots: { index: false, follow: true },
};

export default async function ShopsPage({ searchParams }: { searchParams: SearchParams }) {
  const m = getMessages();
  const locale = m.meta.intlLocale;
  const params = await searchParams;

  // A district + zone picked on the home page, an old ?area= Kochi link, or browser coordinates.
  const picked = findZone(first(params.district), first(params.zone)) ?? findLegacyKochiArea(first(params.area));
  const area = picked?.zone;
  // "Change" returns to the zones of the same district.
  const changeHref = picked ? `/?district=${picked.district.id}#book` : "/#book";
  const radius = RADII_M.find((r) => String(r) === first(params.radius)) ?? RADII_M[0];
  const input = nearbyShopsInputSchema.safeParse({
    p_lng: area ? area.lng : Number(first(params.lng)),
    p_lat: area ? area.lat : Number(first(params.lat)),
    p_radius_m: radius,
  });

  if (!input.success) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>{m.results.invalidLocation}</AlertDescription>
        </Alert>
        <Link href={changeHref} className={buttonVariants({ variant: "outline" })}>
          {m.results.pickAnotherArea}
        </Link>
      </div>
    );
  }

  const shops = await searchNearbyShops(input.data);
  const radiusText = formatDistance(radius, locale);
  const widerRadius = RADII_M.find((r) => r > radius);
  const locationQuery = picked
    ? `district=${picked.district.id}&zone=${picked.zone.id}`
    : `lat=${input.data.p_lat}&lng=${input.data.p_lng}`;
  const widerLink = widerRadius && (
    <Link
      href={`/shops?${locationQuery}&radius=${widerRadius}`}
      className={buttonVariants({ variant: shops.length === 0 ? "default" : "ghost", className: "w-full" })}
    >
      {format(m.results.searchWider, { radius: formatDistance(widerRadius, locale) })}
    </Link>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {picked
              ? format(m.results.titleNearArea, {
                  area: format(m.results.areaInDistrict, { area: picked.zone.name, district: picked.district.name }),
                })
              : m.results.title}
          </h1>
          {shops.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {shops.length === 1
                ? format(m.results.countOne, { radius: radiusText })
                : format(m.results.count, { count: shops.length, radius: radiusText })}
            </p>
          )}
        </div>
        <Link href={changeHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <MapPin aria-hidden />
          {m.results.changeLocation}
        </Link>
      </div>

      {shops.length === 0 ? (
        <div className="space-y-4 rounded-xl border border-dashed p-6 text-center">
          <h2 className="font-semibold">{m.results.noResultsTitle}</h2>
          <p className="text-sm text-muted-foreground">{format(m.results.noResultsBody, { radius: radiusText })}</p>
          <div className="flex flex-col gap-2">
            {widerLink}
            <Link href={changeHref} className={buttonVariants({ variant: "outline", className: "w-full" })}>
              {m.results.pickAnotherArea}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {shops.map((shop) => {
              const price = shop.startingPrice;
              return (
                <li key={shop.id}>
                  <Link
                    href={`/shops/${shop.slug}`}
                    className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="truncate font-semibold">{shop.name}</h2>
                      <p className="truncate text-sm text-muted-foreground">
                        {[shop.area, shop.city].filter(Boolean).join(", ")}
                      </p>
                      <p className="flex flex-wrap gap-x-3 text-sm">
                        <span>{format(m.results.away, { distance: formatDistance(shop.distance_m, locale) })}</span>
                        {price !== null && (
                          <span className="font-medium">
                            {format(m.results.fromPrice, { price: formatPricePaise(price, locale) })}
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          {widerLink}
        </>
      )}
    </div>
  );
}
