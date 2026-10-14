# Security review: open issues

Reviewed on 2026-10-15: every migration in `supabase/migrations`, the `notify-booking` Edge
Function, the website's server code (`apps/web/src/app/actions`, `lib/`, `middleware.ts`), the
partner app's auth/session code and `supabase/config.toml`.

Most of the security setup is solid. Every table has RLS. Every `security definer` function pins
`search_path = ''`. Bookings can only be created through `book_appointment`. Double booking is
blocked by an exclusion constraint. `barbers.user_id` can't be written by clients. The webhook
secret is compared in constant time. Neither app contains the `service_role` key. The issues
below are what remains, most important first.

Fix each database issue with a new migration plus a pgTAP test in `supabase/tests/database`,
following the schema change workflow in `CLAUDE.md`.

| # | Severity | Issue | Where |
|---|----------|-------|-------|
| 1 | Medium | Open redirect after login | `apps/web/src/lib/redirect.ts` |
| 2 | Medium | Shop owners can add any user to their shop and read that user's phone number | `shop_members` policies |
| 3 | Medium | Phone OTP can be abused to run up SMS costs | Supabase Auth settings |
| 4 | Low | Anyone can sign up and host images in the public photo bucket | `shop-photos` storage policies |
| 5 | Low | Barber invites are accepted automatically, without consent | `claim_barber_invites` |
| 6 | Low | Push tokens aren't tied to the device that owns them | `push_tokens` |
| 7 | Low | No limit on how many shops one account can create | `create_shop` |
| 8 | Decision | Per-request CSP nonce makes every page dynamic (security vs. speed) | `apps/web/src/middleware.ts` |
| 9 | Config | Move the hosted project to asymmetric JWT signing keys and the new API keys | Supabase dashboard |
| 10 | Process | Keep seed data and test OTPs out of production | `supabase/seed.sql`, `config.toml` |
| 11 | Compliance | Privacy notice and consent under India's DPDP Act | Website and partner app |

---

## 1. Open redirect after login (Medium)

**Where:** `apps/web/src/lib/redirect.ts` (`safeNextPath`), used by `login/page.tsx` and
`login/login-form.tsx`.

**Problem:** `safeNextPath` rejects values starting with `//` and `/\`, but it doesn't catch a
tab or newline after the first slash. Browsers strip tabs and newlines from URLs, so
`/\t/evil.com` becomes `//evil.com`, which points to another site. Verified:

```
safeNextPath("/\t/evil.com")  -> "/\t/evil.com"   (accepted)
new URL("/\t/evil.com", "https://cape001.in").href -> "https://evil.com/"
```

**Attack:** someone sends a customer
`https://<site>/login?next=/%09/evil.example/fake-booking`. The customer logs in on the real
site and lands on a phishing page that looks like Cape 001.

**Fix:** resolve the path against a dummy origin and accept it only if the origin is unchanged.
Add a unit test for the bypasses:

```ts
export function safeNextPath(next: string | null | undefined, fallback = "/bookings"): string {
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const base = "http://localhost";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
```

Test cases: `/\t/evil.com`, `/\n/evil.com`, `//evil.com`, `/\\evil.com`,
`/%2F%2Fevil.com` (should stay on-site), `https://evil.com`, `/bookings?x=1#y` (allowed).

---

## 2. Owners can add any user to their shop and read that user's phone number (Medium)

**Where:** `20261001183931_shops_and_members.sql`. The policy
`"Owners can add members"` on `shop_members`, together with
`"Shop members can read co-member profiles"` on `profiles`.

**Problem:** the insert policy only checks that the caller owns the shop. It doesn't check who
is being added, so an owner can insert any `user_id` with any role. Everyone in a shop can read
co-members' profiles, so the owner can then read that user's full name and phone number.

Owner accounts are self-serve: anyone with a phone number can call `create_shop`, and no
approval is needed to have members. User ids aren't secret either. `shops.created_by` and
`shops.approved_by` are readable by **anonymous** visitors on every active shop. The default
`select` grant was never narrowed, and `approved_by` is a platform admin's id.

**Attack:**
1. Sign up and create a shop.
2. Read `created_by` / `approved_by` from the public `shops` table to collect other owners' and
   the admin's user ids.
3. Insert each id into your own shop's `shop_members`.
4. Read their phone numbers from `profiles`.

Victims also show up as members of the attacker's shop in the partner app.

**Fix (one migration):**
- Neither app writes `shop_members` directly. Membership only comes from `create_shop` and
  `claim_barber_invites`, which are `security definer`. So drop the insert and update policies
  and revoke the grants: `revoke insert, update on public.shop_members from authenticated;`.
  If owners later need to remove staff or change roles, add a `security definer` function for
  it.
- Hide the user-id columns from the public:
  `revoke select on public.shops from anon, authenticated;` then grant `select` on every column
  except `created_by` and `approved_by`. Check `apps/web/src/lib/shops.ts` and the partner app
  for `select('*')` before doing this.
- pgTAP tests: an owner can't insert another user into their shop, and `anon` can't read
  `shops.created_by` or `shops.approved_by`.

---

## 3. Phone OTP can be abused to run up SMS costs (Medium, costs money)

**Where:** Supabase Auth (phone provider). `config.toml` sets `sms_sent = 30` and has
`[auth.captcha]` commented out, but `config.toml` only applies locally. The hosted project has
its own settings.

**Problem:** the website and the partner app both send an SMS code to any number typed in.
Bots use forms like this for "SMS pumping": they send codes to premium or foreign numbers and
the SMS bill goes to you. It can also be used to spam real people with codes.

**Fix (all free):**
- Turn on **CAPTCHA** in the hosted project (Cloudflare Turnstile is free) and send the token
  with `signInWithOtp` in `apps/web/src/components/auth/phone-otp-form.tsx` and the partner
  login screen.
- In the hosted dashboard (Auth → Rate Limits), set low SMS limits per hour.
- Only allow Indian numbers: the client schemas already require `+91`. Also enforce it on the
  server with a **Send SMS Hook**, or with your SMS provider's geo-permissions, so a direct API
  call can't send to other countries.
- Set a spending alert with the SMS provider.

---

## 4. Anyone can sign up and host images in the public photo bucket (Low)

**Where:** `20261001190832_shop_photos.sql`, the storage insert/update policies.

**Problem:** uploads only require the caller to be owner or manager of the shop in the path.
Shops can be created by anyone and stay unapproved, and the bucket is public. So any new
account can upload images that are served from your Supabase domain without review. That can
mean abusive content, phishing images, or using your storage as free hosting.

**Fix:** also require the shop to be approved for uploads
(`and exists (select 1 from public.shops s where s.id = private.shop_id_from_path(name) and s.is_active)`).
Or allow uploads before approval but have the admin review the photos as part of approval.

---

## 5. Barber invites are accepted automatically (Low)

**Where:** `20261003063239_barber_invites.sql`, `claim_barber_invites`, which is called on every
partner-app login (`apps/partner/src/lib/session.tsx`).

**Problem:** an owner can invite any Indian mobile number. When that person signs in to the
partner app, they're linked to the shop as a barber without being asked. Owners and managers of
that shop can then see their name and phone number (issue 2's co-member policy). The person
might be a customer who installed the partner app, or someone who never agreed to join.

**Fix:** split it into two steps. List pending invites (`my_barber_invites()`), then show
"Join *Shop name* as a barber?" with Accept / Decline. Accepting calls
`accept_barber_invite(barber_id)`. Don't link on login.

---

## 6. Push tokens aren't tied to the device that owns them (Low)

**Where:** `20261003063247_push_tokens.sql`.

**Problem:** a user can store any well-formed Expo push token under their own account. If
someone gets another person's token, they can register it on their own shop. Booking
notifications (shop name, service, barber, time) would then go to that other phone. Getting a
token is hard, so the risk is low.

**Fix:** turn on Expo's **enhanced push security** and set `EXPO_ACCESS_TOKEN` for the
`notify-booking` function. That stops anyone else from sending to your tokens. Optionally,
delete a token from other accounts when it's registered to a new one, so one device belongs to
one user.

---

## 7. No limit on how many shops one account can create (Low)

**Where:** `create_shop`.

**Problem:** one account can create unlimited pending shops. That clutters the admin queue and
lets someone reserve brand slugs (squatting).

**Fix:** in `create_shop`, refuse when the caller already owns, say, 3 shops that aren't
approved yet (`raise exception 'TOO_MANY_PENDING_SHOPS'`). Add the code to `@cape001/core`'s
error list.

---

## 8. Decision: per-request CSP nonce vs. page speed

**Where:** `apps/web/src/middleware.ts` and `apps/web/src/app/layout.tsx` (`await headers()`).

**Trade-off:** the nonce-based Content Security Policy is good protection against XSS. But to
use it, Next.js has to render **every page fresh on every request**. The build output shows
every route as `ƒ (Dynamic)`, including the home page and shop pages, so none of them can be
served from a CDN cache.

**Options:**
- **A. Keep it as is.** This is the most secure option, and the pages are already fast enough
  with Supabase in Mumbai.
- **B. Static CSP for public pages.** Drop the nonce for `/` and `/shops/*` and use a CSP with
  `script-src 'self'` and hashes, or Next.js's experimental SRI. Those pages can then be static
  or ISR and served from the CDN. Keep the nonce for `/login`, `/bookings` and `/book`. This is
  noticeably faster for first-time visitors, but means maintaining two policies.

Decide before launch. If you choose B, re-check the CSP in the browser console on every route.

---

## 9. Config: asymmetric JWT signing keys and the new API keys

**Where:** hosted Supabase dashboard → Settings → JWT Keys / API Keys.

- Switch the project to **asymmetric (ES256) JWT signing keys**. Then `supabase.auth.getClaims()`
  (called in `middleware.ts` and on every logged-in page) checks the token **locally** instead
  of calling the Auth server. That saves one or two network round trips per page. You can also
  rotate or revoke keys without logging everyone out.
- Move from the legacy `anon` / `service_role` JWT keys to the new **publishable** and
  **secret** keys. The `notify-booking` function already prefers `SUPABASE_SECRET_KEYS`. Then
  revoke the legacy keys so an old leaked key stops working.

---

## 10. Process: keep seed data and test OTPs out of production

- `supabase/seed.sql` creates users with password `password123` and a known
  `notify_booking_secret`. It runs on `db reset`. Never run `supabase db reset --linked` against
  the hosted project.
- `[auth.sms.test_otp]` (fixed code `123456` for two numbers) is local-only. Make sure the
  hosted Auth settings have **no** test OTP numbers.
- Set a long random `notify_booking_secret` in the hosted project's Vault, and the same value as
  `NOTIFY_BOOKING_SECRET` on the function.

---

## 11. Compliance: privacy notice and consent (DPDP Act, 2023)

Customer phone numbers and names are shown to shop staff (owners, managers and the booked
barber), and barbers' details to their shop. That's expected for a booking app, but under India's
Digital Personal Data Protection Act you need:
- A privacy notice at login and booking that says who sees the customer's phone number and why.
- A way to delete an account (`profiles` cascades from `auth.users`. Bookings use
  `on delete restrict`, so decide whether to anonymise old bookings).
- A data-retention rule for old bookings and cancelled-booking reasons.
