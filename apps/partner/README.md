# Cape 001 Partner (Expo)

The mobile app for shop owners, managers and barbers. Expo SDK 57, expo-router, TypeScript.
Talks to the same Supabase database as the website, with the anon key only.

## Run it on your Android phone with Expo Go (local Supabase)

Your phone can't reach `127.0.0.1` on your computer, so the app has to use your computer's
**Wi-Fi IP address**, and Windows has to let the phone in.

### 1. One-time setup on the computer

1. **Same Wi-Fi.** Connect the phone and the computer to the same Wi-Fi network.

2. **Find your computer's Wi-Fi IP.** In a terminal run `ipconfig` and look under
   *Wireless LAN adapter Wi-Fi* → *IPv4 Address*, e.g. `192.168.29.89`.
   Ignore `vEthernet (WSL…)` (`172.x.x.x`) and `169.254.x.x` addresses. The IP can change when
   you reconnect; if the app stops connecting, check it again.

3. **Mark the Wi-Fi as a private network** (only for your home/office Wi-Fi):
   Windows Settings → Network & internet → Wi-Fi → *your network* → **Private network**.
   On a *Public* network, Windows Firewall blocks the phone.

4. **Allow the two ports through Windows Firewall.** Open PowerShell **as Administrator** and run:

   ```powershell
   New-NetFirewallRule -DisplayName "Cape001 Supabase API" -Direction Inbound -Protocol TCP -LocalPort 54321 -Action Allow -Profile Private
   New-NetFirewallRule -DisplayName "Cape001 Expo Metro"   -Direction Inbound -Protocol TCP -LocalPort 8081  -Action Allow -Profile Private
   ```

5. **Create `apps/partner/.env`** from `apps/partner/.env.example`:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=http://192.168.29.89:54321   # your Wi-Fi IP from step 2
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...                      # ANON_KEY from `pnpm exec supabase status`
   ```

   Only the anon key goes here, never the service_role / secret key.

6. **On the phone:** install **Expo Go** from the Play Store. It must support SDK 57 (the current
   Play Store version does; if Expo Go says the project is incompatible, update Expo Go).

### 2. Every time

From the repo root:

```bash
pnpm db:start        # local Supabase (Docker Desktop must be running)
pnpm dev:partner     # starts Metro and shows a QR code
```

Scan the QR code with Expo Go. The first load takes a minute.

**Check the connection from the phone:** open `http://192.168.29.89:54321/rest/v1/` (your IP) in
the phone's browser. If it shows a short JSON message, the phone can reach Supabase. If it never
loads, re-check steps 2–4.

### 3. Try the whole flow

Local logins use test numbers (no SMS is sent): **+91 99999 99999** or **+91 99999 99998**, code
**123456**.

1. Log in with 99999 99999 → enter your name → **Create your shop**. Tap *"I'm at my shop – use
   my location"* (at home, any location is fine for testing).
2. You now see **Waiting for approval**. Approve the shop from the computer:

   ```bash
   pnpm db:approve-shop              # lists shops waiting for approval
   pnpm db:approve-shop <slug>       # approves one
   ```

   Then tap **Check again** in the app. (`db:approve-shop` only runs against a local Supabase.)
3. **Shop → Services and prices:** add a service. **Shop → Barbers:** add a barber, tick their
   services, save, then set **Working hours**.
4. **Invite a barber:** on the barber's page, enter `99999 99998` under *App login* and save.
   Log out, log in with 99999 99998 – you go straight into the shop as that barber and see only
   their own bookings.
5. **Live bookings:** book an appointment on the website (`pnpm dev:web`,
   http://localhost:3000) and watch it appear on the phone's **Bookings** tab without refreshing.

Need more test numbers (e.g. one more customer)? Add them under `[auth.sms.test_otp]` in
`supabase/config.toml`, then `pnpm db:stop && pnpm db:start`.

### Push notifications need a development build

Expo Go on Android can't receive remote push notifications (removed in SDK 53). In Expo Go the
app skips push setup and the *Me* tab says so; bookings still update live while the app is open.
To test notifications on the phone:

1. `npx eas-cli@latest init` in `apps/partner` (creates the EAS project id the push token needs).
2. Create a Firebase project with an Android app for this package name and upload the FCM V1
   service account key with `npx eas-cli@latest credentials`.
3. `npx eas-cli@latest build --profile development --platform android`, install the APK on the
   phone, then run `npx expo start --dev-client` and open the project from the development build.
4. Make sure `supabase/functions/.env` exists (copy `supabase/functions/.env.example`) so the
   local `notify-booking` function can send through Expo's push service.

### Troubleshooting

- **"Network request failed" / stuck on the splash screen:** wrong IP in `.env`, firewall, or the
  Wi-Fi is still *Public*. Changing `.env` needs a Metro restart (`pnpm dev:partner` again).
- **Port 8081 already in use:** an older `expo start` is still running. Close it (or end the
  `node` process using port 8081) and start again.
- **Phone and computer on different networks** (e.g. office Wi-Fi blocks devices from talking to
  each other): `npx expo start --tunnel` fixes Metro, but the app still needs to reach Supabase on
  `:54321`; use a network where the phone can open the URL in the check above.

## Code layout

```
src/app/            screens (expo-router); src/app/_layout.tsx decides login → name → create
                    shop → waiting for approval → app, from lib/session.tsx
src/app/(app)/      the signed-in app: (tabs)/ Bookings · Shop · Me, and pushed screens
src/components/     big, simple UI building blocks (ui.tsx), pickers, booking card
src/i18n/en.ts      every piece of text in the app
src/lib/            Supabase client (session in expo-secure-store), session, push, photos
```

Shared validation, error codes and IST date helpers come from `@cape001/core`; database types
from `@cape001/db`. Check the app with `pnpm --filter @cape001/partner typecheck` and
`pnpm --filter @cape001/partner lint` (or `npx expo lint` in this folder).
