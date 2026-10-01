import "server-only";
import { cache } from "react";
import { shopSlugSchema } from "@cape001/core";
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

export const getShopBySlug = cache(async (slug: string) => {
  if (!shopSlugSchema.safeParse(slug).success) return null;

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
});

export type ShopDetails = NonNullable<Awaited<ReturnType<typeof getShopBySlug>>>;

/** Lowest active service price per shop, for "from ₹X" on the results page. */
export async function getStartingPrices(shopIds: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  if (shopIds.length === 0) return prices;

  const { data, error } = await createPublicClient()
    .from("services")
    .select("shop_id, price_paise")
    .in("shop_id", shopIds)
    .eq("is_active", true);
  if (error) throw error;

  for (const { shop_id, price_paise } of data) {
    const current = prices.get(shop_id);
    if (current === undefined || price_paise < current) prices.set(shop_id, price_paise);
  }
  return prices;
}

/** A Google Maps search link for the address. Opens the Maps app on phones; no API key needed. */
export function mapsSearchUrl(shop: Pick<ShopDetails, "name" | "address_line" | "area" | "city">): string {
  const query = [shop.name, shop.address_line, shop.area, shop.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
