import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/bookings", "/login", "/shops/*/book"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
