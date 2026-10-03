"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KOCHI_AREAS } from "@cape001/core";
import { Loader2, LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMessages } from "@/i18n/provider";

type Status = "idle" | "locating" | "denied" | "unavailable";

export function LocationPicker() {
  const m = useMessages();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");

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
      <Button size="lg" className="h-12 w-full text-base" onClick={useMyLocation} disabled={status === "locating"}>
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

      <section aria-labelledby="pick-area">
        <h2 id="pick-area" className="mb-3 text-sm font-medium text-muted-foreground">
          {m.home.orPickArea}
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {KOCHI_AREAS.map((area) => (
            <li key={area.id}>
              <Link
                href={`/shops?area=${area.id}`}
                className="flex h-12 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                <MapPin className="size-4 text-muted-foreground" aria-hidden />
                {m.areas[area.id]}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
