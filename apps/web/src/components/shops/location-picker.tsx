"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KERALA_DISTRICTS, findDistrict } from "@cape001/core";
import { ChevronLeft, ChevronRight, Loader2, LocateFixed, MapPin } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";

type Status = "idle" | "locating" | "denied" | "unavailable";

// Long names (Thiruvananthapuram, Kesavadasapuram...) get a full row on phones instead of being cut.
const wide = (name: string) => (name.length > 14 ? "col-span-2 sm:col-span-1" : undefined);

export function LocationPicker() {
  const m = useMessages();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("idle");

  // The open district lives in the URL (?district=), so Back and the results page's "Change"
  // link return to its zones. Plain links, so they work even before the page has hydrated.
  const district = findDistrict(searchParams.get("district"));

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // ~11 m precision is plenty for "nearby" and keeps exact positions out of URLs and logs.
        const lat = coords.latitude.toFixed(4);
        const lng = coords.longitude.toFixed(4);
        router.push(`/shops?lat=${lat}&lng=${lng}`);
      },
      (error) => setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  return (
    <div className="space-y-6">
      <Button size="lg" className="h-14 w-full text-base" onClick={useMyLocation} disabled={status === "locating"}>
        {status === "locating" ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <LocateFixed aria-hidden />
        )}
        {status === "locating" ? m.home.locating : m.home.useLocation}
      </Button>

      {(status === "denied" || status === "unavailable") && (
        <Alert role="status">
          <AlertDescription>
            {status === "denied" ? m.home.locationDenied : m.home.locationUnavailable}
          </AlertDescription>
        </Alert>
      )}

      {district ? (
        <section aria-labelledby="pick-zone" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="pick-zone" className="font-display text-xs tracking-[0.08em] text-graphite">
              {format(m.home.pickZone, { district: district.name })}
            </h3>
            <Link href="/" scroll={false} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <ChevronLeft aria-hidden />
              {m.home.allDistricts}
            </Link>
          </div>
          <ul className="grid grid-flow-row-dense grid-cols-2 gap-2 sm:grid-cols-3">
            {district.zones.map((zone) => (
              <li key={zone.id} className={wide(zone.name)}>
                <Link
                  href={`/shops?district=${district.id}&zone=${zone.id}`}
                  className="group flex h-12 items-center gap-2 rounded-full border border-ink/15 px-4 text-[15px] transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                >
                  <MapPin className="hidden size-4 shrink-0 opacity-50 group-hover:opacity-100 sm:block" aria-hidden />
                  <span className="truncate">{zone.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section aria-labelledby="pick-district" className="space-y-3">
          <h3 id="pick-district" className="font-display text-xs tracking-[0.08em] text-graphite">
            {m.home.orPickDistrict}
          </h3>
          <ul className="grid grid-flow-row-dense grid-cols-2 gap-2 sm:grid-cols-3">
            {KERALA_DISTRICTS.map((d) => (
              <li key={d.id} className={wide(d.name)}>
                <Link
                  href={`/?district=${d.id}`}
                  scroll={false}
                  className="group flex h-12 items-center gap-2 rounded-full border border-ink/15 px-4 text-[15px] transition-colors hover:border-ink hover:bg-ink hover:text-paper justify-between"
                >
                  <span className="truncate">{d.name}</span>
                  <ChevronRight className="hidden size-4 shrink-0 opacity-50 transition-transform sm:block group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
