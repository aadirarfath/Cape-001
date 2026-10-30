# Pre-launch checklist

A running list of everything that must be done (or decided) before Cape 001 goes live.
Tick items off in the PR that completes them, and add new ones as they come up.

Schema changes still go through `supabase/migrations` only (see CLAUDE.md). The steps below are
dashboard settings, secrets and data, which migrations can't or shouldn't hold.

## Supabase Auth

- [ ] **Real SMS provider** (e.g. Twilio, MSG91) configured in the Supabase dashboard:
      Authentication → Providers → Phone. Never put real credentials in `supabase/config.toml`;
      the Twilio values there are local placeholders.
- [ ] **"Confirm phone" turned on** (Authentication → Providers → Phone), matching
      `[auth.sms] enable_confirmations = true` locally. Without it, a phone + password signup is
      auto-confirmed without an OTP, and anyone could claim a barber invite for someone else's
      number (`claim_barber_invites` trusts the confirmed auth phone).
- [x] **Rate limiting and Cloudflare Turnstile on the OTP forms** (website login and partner app
      login). Set Auth rate limits for SMS in the dashboard, and enable CAPTCHA protection
      (Authentication → Attack Protection → Turnstile) with the matching widget in both apps.
      SMS costs money per message, and OTP endpoints are a common abuse target.
      *(Code implementation completed in `apps/web` and `apps/partner` using `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `EXPO_PUBLIC_TURNSTILE_SITE_KEY`)*.

## Booking notifications (notify-booking)

- [ ] Deploy the function: `supabase functions deploy notify-booking`
      (`verify_jwt = false` comes from `supabase/config.toml`).
- [ ] Set its secret: `supabase secrets set NOTIFY_BOOKING_SECRET=<long random value>`.
- [ ] Store the function URL and the **same** secret in Vault, once, in the SQL editor of the
      hosted project:
      ```sql
      select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/notify-booking', 'notify_booking_url');
      select vault.create_secret('<same value as NOTIFY_BOOKING_SECRET>', 'notify_booking_secret');
      ```
      Until both exist, the booking triggers do nothing (bookings still work, no pushes).
- [ ] Make a test booking and check `net._http_response` shows `200` and `"sent"` > 0.
- [ ] Optional: turn on enhanced push security in the Expo project, then
      `supabase secrets set EXPO_ACCESS_TOKEN=<token>`.
- [x] **Expo push receipts and retry for failed notifications.** The function reads only the
      immediate push tickets. Add a scheduled job that fetches receipts about 15 minutes later
      (removing `DeviceNotRegistered` tokens and logging credential errors), and retry
      sends that failed with 429/5xx using exponential backoff. pg_net does not retry.
      *(Implemented in `20261030010003_push_notification_receipts_and_retries.sql`, `notify-booking`, and `process-push-receipts` Edge Function)*.

## Partner app (Android)

*See detailed guide and build commands in [docs/PARTNER-APP-PRODUCTION-AND-APK.md](PARTNER-APP-PRODUCTION-AND-APK.md).*

- [ ] EAS project created (`npx eas-cli@latest init`) so the app has a `projectId` for Expo
      push tokens.
- [ ] Firebase project with an Android app for the package name; FCM V1 service account key
      uploaded to EAS (`eas credentials`). Without it Android pushes don't arrive.
- [ ] Production build with `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` of the
      hosted project (anon key only, never service_role). Build standalone `.apk` using:
      `npx eas-cli@latest build --platform android --profile preview`

## Website

- [x] **HSTS preload** once the production domain is final: send
      `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` from every
      subdomain over HTTPS, then submit the domain at hstspreload.org. Preloading is hard to
      undo, so wait until the domain and all subdomains are settled.
      *(Configured in `apps/web/next.config.ts`)*.

## Data protection and product

- [x] **Account deletion by anonymising the customer (DPDP Act).** Bookings must stay for the
      shops' records (`bookings.customer_id` is `on delete restrict`), so a deletion request
      should clear the profile's name and phone, delete the auth user's personal data and keep
      the bookings pointing at an anonymised profile. Needs a migration and a function, plus a
      clear "delete my account" flow in the website.
      *(Implemented via `delete_my_account()` in `20261030010001_customer_account_deletion.sql`, UI flow in `apps/web/src/components/auth/delete-account-button.tsx`, and pgTAP test suite)*.
- [x] **No-show tracking for shops.** Staff can already mark bookings `no_show`; decide what
      shops see (per-customer no-show counts) and whether repeated no-shows limit booking.
      *(Implemented in `20261030010002_no_show_tracking.sql`, with `get_customer_no_show_count()` RPC, 3-strike recent no-show limit `TOO_MANY_NO_SHOWS` in `book_appointment`, customer no-show badges in `apps/partner`, and pgTAP tests)*.

## SEO and discoverability

- [x] **Server-side rendering** — all pages are Next.js server components; content is in the HTML on first byte.
- [x] **robots.txt** — `apps/web/src/app/robots.ts` disallows `/bookings`, `/login`, and `/shops/*/book`.
- [x] **sitemap.xml** — `apps/web/src/app/sitemap.ts` lists home + all active shop pages (revalidated hourly).
- [x] **Unique title tags** — root layout uses `template: "%s · Cape 001"`. Home, shop, results, login, bookings, privacy, contact pages all export `metadata` with unique titles.
- [x] **Meta descriptions** — root layout default; shop pages use dynamic descriptions from DB content.
- [x] **One H1 per page** — verified: every page has exactly one `<h1>`.
- [x] **Canonical tags** — home `/`, shop `/shops/[slug]`, privacy `/privacy`, contact `/contact` all set `alternates.canonical`. Login and bookings are `robots: { index: false }`.
- [x] **Open Graph images** — shop pages use the first shop photo. Root layout sets default OG image (`/opengraph-image.png`). Place a 1200×630 PNG at `apps/web/public/opengraph-image.png` before going live.
- [x] **Custom 404 page** — `apps/web/src/app/not-found.tsx` — branded, H1, back-to-home link.
- [x] **301 redirects** — `next.config.ts` `redirects()` normalises trailing slashes for `/shops/`, `/privacy/`, `/contact/`.
- [x] **Alt text** — shop photos use DB `alt_text` field (falls back to shop name). Barber avatars use `barber.display_name`. Decorative elements have `aria-hidden`.
- [x] **WebP images** — `next.config.ts` adds `images.remotePatterns` for Supabase Storage and sets `formats: ["image/webp", "image/avif"]`. Next.js `<Image>` serves WebP automatically. Barber avatar raw `<img>` has `loading="lazy"`.
- [x] **Lazy loading** — Next.js `<Image>` is lazy by default; raw `<img>` tags below the fold have `loading="lazy"`.
- [x] **Organization schema** — `Organization` JSON-LD block in root layout (`apps/web/src/app/layout.tsx`).
- [x] **Breadcrumbs** — `Breadcrumbs` component with `BreadcrumbList` JSON-LD on shop and results pages (`apps/web/src/components/site/breadcrumbs.tsx`).
- [x] **Internal links** — footer nav, shop → book, results → shop, home → shops. Privacy and Contact in footer.
- [ ] **Google Analytics** — GA4 script component at `apps/web/src/components/site/analytics.tsx`. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in production. CSP updated to allow `googletagmanager.com`.
- [ ] **Search Console** — Add site in Google Search Console, copy the HTML-tag verification value into `NEXT_PUBLIC_GSC_SITE_VERIFICATION` (root layout injects it as `<meta name="google-site-verification">`).
- [x] **Privacy policy** — `/privacy` page at `apps/web/src/app/(site)/privacy/page.tsx`. Covers DPDP Act, data categories, retention, cookies, rights, and contact. Linked from footer.
- [x] **Working contact form** — `/contact` page at `apps/web/src/app/(site)/contact/page.tsx` with form pre-filling a `mailto:` link plus direct email addresses. Linked from footer.

## Operations

- [ ] **Point-in-Time Recovery backups** enabled on the hosted project (Database → Backups).
      Requires a paid plan and the compute add-on; confirm the retention period.
