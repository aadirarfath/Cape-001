import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { shopSlugSchema } from "@cape001/core";
import type { Database } from "@cape001/db";
import { SUPABASE_URL } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

// Public catalogue reads for a shop page. RLS exposes only active shops and their active
// barbers/services to anon; the explicit is_active filters also hide inactive rows from staff
// who happen to browse the public site while logged in.

export const SHOP_PHOTOS_BUCKET = "shop-photos";

export function shopPhotoUrl(storagePath: string): string {
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/${SHOP_PHOTOS_BUCKET}/${encoded}`;
}

// Public catalogue data is cached across requests for this long. Changes made in the partner app
// (services, prices, barbers, hours shown here) appear on the website within this window; the
// booking functions always check live data, so a stale page can't create an invalid booking.
const CATALOGUE_REVALIDATE_SECONDS = 60;

export const getShopBySlug = cache(async (slug: string) => {
  if (!shopSlugSchema.safeParse(slug).success) return null;
  return getShopBySlugCached(slug);
});

const getShopBySlugCached = unstable_cache(loadShop, ["shop-by-slug"], {
  revalidate: CATALOGUE_REVALIDATE_SECONDS,
});

async function loadShop(slug: string) {
  const supabase = createPublicClient();

  const { data: shop, error } = await supabase
    .from("shops")
    .select(
      "id, name, slug, description, phone, address_line, area, city, state, postal_code, max_days_ahead, cancellation_cutoff_minutes",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  if (!shop) return null;

  const [services, barbers, barberServices, photos] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, duration_minutes, price_paise")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("barbers")
      .select("id, display_name, bio, avatar_url")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("display_name"),
    supabase.from("barber_services").select("barber_id, service_id").eq("shop_id", shop.id),
    supabase
      .from("shop_photos")
      .select("id, storage_path, alt_text")
      .eq("shop_id", shop.id)
      .order("sort_order")
      .order("created_at"),
  ]);

  for (const result of [services, barbers, barberServices, photos]) {
    if (result.error) throw result.error;
  }

  return {
    ...shop,
    services: services.data ?? [],
    barbers: barbers.data ?? [],
    barberServices: barberServices.data ?? [],
    photos: (photos.data ?? []).map((photo) => ({ ...photo, url: shopPhotoUrl(photo.storage_path) })),
  };
}

export type ShopDetails = NonNullable<Awaited<ReturnType<typeof getShopBySlug>>>;

type NearbyShopsInput = Database["public"]["Functions"]["nearby_shops"]["Args"];

/**
 * Active shops near a point, each with its lowest active service price ("from ₹X"), or null
 * when it has no services. Cached per location and radius.
 */
export const searchNearbyShops = unstable_cache(
  async (input: NearbyShopsInput) => {
    const supabase = createPublicClient();
    const { data: shops, error } = await supabase.rpc("nearby_shops", input);
    if (error) throw error;
    if (shops.length === 0) return [];

    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("shop_id, price_paise")
      .in(
        "shop_id",
        shops.map((shop) => shop.id),
      )
      .eq("is_active", true);
    if (servicesError) throw servicesError;

    return shops.map((shop) => {
      const prices = services.filter((s) => s.shop_id === shop.id).map((s) => s.price_paise);
      return { ...shop, startingPrice: prices.length > 0 ? Math.min(...prices) : null };
    });
  },
  ["nearby-shops"],
  { revalidate: CATALOGUE_REVALIDATE_SECONDS },
);

/** A Google Maps search link for the address. Opens the Maps app on phones; no API key needed. */
export function mapsSearchUrl(shop: Pick<ShopDetails, "name" | "address_line" | "area" | "city">): string {
  const query = [shop.name, shop.address_line, shop.area, shop.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
