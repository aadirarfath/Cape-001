import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, Phone } from "lucide-react";
import { formatPricePaise } from "@cape001/core";
import { buttonVariants } from "@/components/ui/button";
import { ShopPhotos } from "@/components/shops/shop-photos";
import { format, getMessages } from "@/i18n";
import { SITE_URL, SUPABASE_URL } from "@/lib/env";
import { getShopBySlug, mapsSearchUrl, type ShopDetails } from "@/lib/shops";

type Params = Promise<{ slug: string }>;

function priceRange(shop: ShopDetails) {
  const prices = shop.services.map((s) => s.price_paise);
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  const m = getMessages();
  if (!shop) return { title: m.shop.notFound, robots: { index: false } };

  const area = shop.area ?? shop.city;
  const range = priceRange(shop);
  const title = format(m.shop.metaTitle, { name: shop.name, area, city: shop.city });
  const description =
    shop.description ??
    format(m.shop.metaDescription, {
      name: shop.name,
      area,
      city: shop.city,
      services: shop.services.slice(0, 3).map((s) => s.name).join(", "),
      price: range ? formatPricePaise(range.min, m.meta.intlLocale) : "",
    });
  const url = `/shops/${shop.slug}`;
  const image = shop.photos[0];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      images: image ? [{ url: image.url, alt: image.alt_text ?? shop.name }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

function structuredData(shop: ShopDetails) {
  const range = priceRange(shop);
  return {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    name: shop.name,
    description: shop.description ?? undefined,
    url: `${SITE_URL}/shops/${shop.slug}`,
    telephone: shop.phone ?? undefined,
    image: shop.photos.length > 0 ? shop.photos.map((p) => p.url) : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: shop.address_line,
      addressLocality: [shop.area, shop.city].filter(Boolean).join(", "),
      addressRegion: shop.state,
      postalCode: shop.postal_code ?? undefined,
      addressCountry: "IN",
    },
    priceRange: range
      ? `${formatPricePaise(range.min)}–${formatPricePaise(range.max)}`
      : undefined,
    makesOffer: shop.services.map((service) => ({
      "@type": "Offer",
      price: (service.price_paise / 100).toFixed(2),
      priceCurrency: "INR",
      itemOffered: { "@type": "Service", name: service.name, description: service.description ?? undefined },
    })),
  };
}

export default async function ShopPage({ params }: { params: Params }) {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const m = getMessages();
  const locale = m.meta.intlLocale;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // Escape "<" so shop text can never close the script element.
  const jsonLd = JSON.stringify(structuredData(shop)).replace(/</g, "\\u003c");

  return (
    <article className="space-y-8 pb-20">
      {/* Browsers blank the nonce attribute after load, so React would report a false mismatch. */}
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <ShopPhotos
        name={shop.name}
        photos={shop.photos}
        photoAlt={format(m.shop.photoAlt, { name: shop.name })}
        placeholderAlt={format(m.shop.placeholderAlt, { name: shop.name })}
      />

      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{shop.name}</h1>
        {shop.description && <p className="text-muted-foreground">{shop.description}</p>}
      </header>

      <section aria-labelledby="address" className="space-y-3">
        <h2 id="address" className="sr-only">
          {m.shop.address}
        </h2>
        <p className="flex gap-2 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            {[shop.address_line, shop.area, shop.city].filter(Boolean).join(", ")}
            {shop.postal_code ? ` ${shop.postal_code}` : ""}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={mapsSearchUrl(shop)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
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

      <section aria-labelledby="services" className="space-y-3">
        <h2 id="services" className="text-lg font-semibold">
          {m.shop.services}
        </h2>
        {shop.services.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.shop.noServices}</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {shop.services.map((service) => (
              <li key={service.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <h3 className="font-medium">{service.name}</h3>
                  {service.description && <p className="text-sm text-muted-foreground">{service.description}</p>}
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden />
                    {format(m.shop.minutes, { count: service.duration_minutes })}
                  </p>
                </div>
                <span className="shrink-0 font-semibold">{formatPricePaise(service.price_paise, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {shop.barbers.length > 0 && (
        <section aria-labelledby="barbers" className="space-y-3">
          <h2 id="barbers" className="text-lg font-semibold">
            {m.shop.barbers}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {shop.barbers.map((barber) => (
              <li key={barber.id} className="flex items-center gap-3 rounded-xl border p-3">
                {barber.avatar_url?.startsWith(SUPABASE_URL) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL; see ShopPhotos
                  <img src={barber.avatar_url} alt="" className="size-12 rounded-full object-cover" />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-12 items-center justify-center rounded-full bg-muted text-lg font-semibold"
                  >
                    {barber.display_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="font-medium">{barber.display_name}</h3>
                  {barber.bio && <p className="text-sm text-muted-foreground">{barber.bio}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {shop.services.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-2xl">
            <Link href={`/shops/${shop.slug}/book`} className={buttonVariants({ size: "lg", className: "h-12 w-full text-base" })}>
              {m.shop.book}
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}
