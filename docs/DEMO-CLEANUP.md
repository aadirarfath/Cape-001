# Demo cleanup

Shortcuts taken to get a working demo on the hosted Supabase project (`cape-001`,
`dbunaksrijcbihhtnkhu`) in October 2026. Undo every item here before launch, then work through
the full pre-launch checklist in [DEPLOY.md](DEPLOY.md).

## Phone login without SMS

- [ ] **Remove the test phone numbers.** The hosted project accepts code `123456` for
      `+91 99999 99999` and `+91 99999 99998` without sending an SMS (Authentication →
      Providers → Phone → Test phone numbers and OTPs). Anyone who knows this can sign in as
      those accounts. Delete both entries, and delete the two test users under
      Authentication → Users.
- [ ] **Replace the placeholder Twilio values** with a real SMS provider (Twilio or MSG91) in
      the same screen. The demo uses fake credentials only so that phone login can be switched
      on; real numbers get no SMS until this is done. See "Real SMS provider" in DEPLOY.md.
- [ ] **Keep "Confirm phone" on.** Do not turn on phone auto-confirm as a shortcut to skip SMS;
      DEPLOY.md explains why it breaks barber invites.
- [ ] **Set the Site URL** (Authentication → URL Configuration) to the production website
      domain. It is still `http://localhost:3000`.

## Placeholder data

- [ ] **Delete or replace the placeholder shops**: Fade Theory (Edappally), Infopark Grooming
      Lounge (Kakkanad) and Fort Kochi Barber Co. Their barbers, services and hours were made up,
      including the phone numbers `+91 98470 10001`–`10003`. Deleting a shop removes its barbers,
      services and hours too. In the SQL editor:
      ```sql
      delete from public.shops where id in (
        'c0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000002',
        'c0000000-0000-4000-8000-000000000003'
      );
      ```
      Bookings made against them during the demo block the delete (`bookings.shop_id` is
      `on delete restrict`); remove those bookings first.
- [ ] **Check shop locations.** The partner app saves the phone's GPS position as the shop's
      location when a shop is created, and the website only lists shops within 50 km of the
      chosen Kochi area. Foil Fade (`fade-theory-kakkanad`) was created away from Kochi during
      the demo and moved to Kakkanad by hand in the SQL editor. Shops created for real should be
      set up (or have their location updated) while standing in the shop.
- [ ] **Delete `supabase/placeholder_data.sql`** from the repo once the real shops are in.

## Shop approval

- [ ] **Build an admin screen for approving shops.** New shops stay hidden until a platform
      admin approves them (`approve_shop`, allowed only for users in `platform_admins`), but
      nothing in the website or partner app calls it yet, and the hosted project has no platform
      admin. During the demo, shops were approved by hand in the SQL editor
      (`update public.shops set is_active = true, approved_at = now() where slug = '…'`),
      which leaves `approved_by` empty. Add a real platform admin and an approval screen, and
      review any shops approved by hand.

## Access and credentials

- [ ] **Stop using the shared personal access token.** `SUPABASE_ACCESS_TOKEN` in the root
      `.env.local` belongs to the project owner's Supabase account and works on every project
      they own. Create your own token (supabase.com/dashboard/account/tokens), and ask the owner
      to revoke the shared one.
- [ ] **Rename `SUPABASE_DB_PASSWORD` in the root `.env.local`** (or move the CLI values out of
      that file). The Supabase CLI reads it and then uses the hosted password for the local
      database, which breaks `pnpm db:types`. Workaround until then:
      `SUPABASE_DB_PASSWORD=postgres pnpm db:types`.

## Repository

- [ ] **Push the phase-3 merge.** `phase-3` (partner app) was merged into `main` locally and has
      not been pushed to GitHub.
- [ ] **Delete the stray `package-lock.json`** at the repo root. The project uses pnpm only.

## Partner app

- [ ] **Expo Go is for the demo only.** The app runs from a dev server on a laptop
      (`pnpm dev:partner`), signed in to Expo as the developer. Real users need a production
      build; see "Partner app (Android)" in DEPLOY.md, and add an iOS build if shops use iPhones.
- [ ] **Make a lighter hero video for phones.** `apps/web/public/hero.mp4` is 4.5 MB at
      2560×1440 and every visitor downloads it, including on mobile data. Encode a ~720p version
      (H.264, no audio, `-movflags +faststart`, roughly 1 MB) and serve it to small screens, plus
      a poster image for the first frame. No ffmpeg on the dev machine yet.
- [ ] **Link the website's "For shops" section to the stores.** The home page shows a
      "Partner app coming soon" label instead of a download button
      (`landing.partners.cta` in `apps/web/src/i18n/en.ts`). Replace it with Play Store / App
      Store links once the Partner app is published.
- [ ] **Replace the partner app's icon and splash screen.** They are still the Expo template's
      (blue splash `#208AEF`, template icons in `apps/partner/assets/images`). Make black-and-white
      ones matching the new design and update `app.json`; this only shows in real builds, not in
      Expo Go.
- [ ] **The partner app does not run in a browser.** It stores the session with
      `expo-secure-store`, which has no web support. Fine for a phone-only app; remove the `web`
      script and `web` block in `app.json` if a web version is not planned.
