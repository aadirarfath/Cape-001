import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let shops: Array<{ slug: string; updated_at: string }> = [];
  try {
    const { data, error } = await createPublicClient()
      .from("shops")
      .select("slug, updated_at")
      .eq("is_active", true)
      .order("slug");
    if (!error && data) shops = data;
  } catch {
    // If database is unreachable during static build, return base routes
  }

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...shops.map((shop) => ({
      url: `${SITE_URL}/shops/${shop.slug}`,
      lastModified: shop.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
