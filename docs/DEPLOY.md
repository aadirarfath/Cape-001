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
- [ ] **Rate limiting and Cloudflare Turnstile on the OTP forms** (website login and partner app
      login). Set Auth rate limits for SMS in the dashboard, and enable CAPTCHA protection
      (Authentication → Attack Protection → Turnstile) with the matching widget in both apps.
      SMS costs money per message, and OTP endpoints are a common abuse target.

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
- [ ] **Expo push receipts and retry for failed notifications.** The function reads only the
      immediate push tickets. Add a scheduled job that fetches receipts about 15 minutes later
      (removing `DeviceNotRegistered` tokens and logging credential errors), and retry
      sends that failed with 429/5xx using exponential backoff. pg_net does not retry.

## Partner app (Android)

- [ ] EAS project created (`npx eas-cli@latest init`) so the app has a `projectId` for Expo
      push tokens.
- [ ] Firebase project with an Android app for the package name; FCM V1 service account key
      uploaded to EAS (`eas credentials`). Without it Android pushes don't arrive.
- [ ] Production build with `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` of the
      hosted project (anon key only, never service_role).

## Website

- [ ] **HSTS preload** once the production domain is final: send
      `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` from every
      subdomain over HTTPS, then submit the domain at hstspreload.org. Preloading is hard to
      undo, so wait until the domain and all subdomains are settled.

## Data protection and product

- [ ] **Account deletion by anonymising the customer (DPDP Act).** Bookings must stay for the
      shops' records (`bookings.customer_id` is `on delete restrict`), so a deletion request
      should clear the profile's name and phone, delete the auth user's personal data and keep
      the bookings pointing at an anonymised profile. Needs a migration and a function, plus a
      clear "delete my account" flow in the website.
- [ ] **No-show tracking for shops.** Staff can already mark bookings `no_show`; decide what
      shops see (per-customer no-show counts) and whether repeated no-shows limit booking.

## Operations

- [ ] **Point-in-Time Recovery backups** enabled on the hosted project (Database → Backups).
      Requires a paid plan and the compute add-on; confirm the retention period.
