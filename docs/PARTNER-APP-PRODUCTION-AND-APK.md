# Cape 001 Partner App: Production Readiness & APK Packaging Guide

This guide details the plan for taking the **Cape 001 Partner mobile app** (`apps/partner`) to production readiness and packaging it into an installable Android `.apk` for physical device testing and sideloading.

---

## 1. Executive Summary

The Cape 001 Partner app is built on **Expo SDK 57** (React Native 0.86, React 19, Expo Router 57). The foundation (session management, role checks, RLS data queries, Realtime subscriptions, and design system) is solid.

To transition from local development/Expo Go to a release-grade standalone Android application:
1. **Packaging Configuration**: Define native package identifier, versioning, permissions, and build profiles in `eas.json`.
2. **Push Notification Hardening**: Foreground alert presentation, audible notification channels, and notification-tap deep-linking directly to booking details (`/(app)/booking/[id]`).
3. **Auth Safety**: Ensure mobile login remains active and unblocked across native platforms.
4. **Resilience & Fallbacks**: Provide custom 404 screens, error boundaries, and offline awareness.
5. **EAS Cloud Build Pipeline**: Use EAS Build to compile standalone `.apk` files without needing local Android Studio/NDK dependencies on Windows.

---

## 2. Production Readiness Checklist

### A. App Identity & Native Settings (`apps/partner/app.json`)

| Setting | Value | Purpose | Status |
|---|---|---|---|
| `android.package` | `com.cape001.partner` | Unique Android application ID | ✅ Configured |
| `android.versionCode` | `1` | Incremental build number for updates | ✅ Configured |
| `android.permissions` | `CAMERA`, `READ_MEDIA_IMAGES`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`, `VIBRATE` | Device hardware & notification access | ✅ Configured |
| Notification Plugin | `icon: "./assets/images/icon.png"`, `color: "#0D0D0D"` | Status bar icon & theme color for incoming alerts | ✅ Configured |
| Splash Screen | Background `#0D0D0D` (Obsidian) | Replaces default Expo blue with Cape 001 branding | ✅ Configured |
| Adaptive Icons | Official Cape 001 brand marks in `./assets/images/` | Android home screen icon | ⚠️ Place final 1024×1024 assets |

### B. Push Notifications & Deep Linking (`apps/partner/src/lib/push.ts` & `_layout.tsx`)

Staff rely on audible, timely alerts when customers book or cancel appointments.

- [x] **Audible Android Notification Channel**: Configured channel `bookings` with `HIGH` importance, vibration pattern `[0, 250, 250, 250]`, and sound enabled.
- [x] **Foreground Presentation**: Configured `Notifications.setNotificationHandler` with `shouldShowBanner: true`, `shouldShowList: true`, and `shouldPlaySound: true`.
- [x] **Notification Tap Navigation**: Wired `Notifications.addNotificationResponseReceivedListener` and `getLastNotificationResponseAsync` to parse `bookingId` from payload and immediately navigate to `/(app)/booking/[id]`.
- [ ] **EAS Project ID**: Run `npx eas-cli@latest init` to populate `extra.eas.projectId`.
- [ ] **Firebase FCM V1 Credentials**: Set up Firebase project, download `google-services.json` into `apps/partner`, and upload FCM V1 service account key to EAS (`npx eas-cli credentials`).

### C. Authentication Hardening (`apps/partner/src/app/login.tsx`)

- [x] **Turnstile Compatibility**: Cloudflare Turnstile CAPTCHA is designed for web. On mobile, `login.tsx` is updated to only require `captchaToken` on web (`Platform.OS === 'web'`), preventing accidental lockout when `EXPO_PUBLIC_TURNSTILE_SITE_KEY` is configured in production.

### D. Resilience & Error Handling

- [x] **404 Catch-All Route**: Created `apps/partner/src/app/+not-found.tsx` to handle broken links or expired deep links gracefully.
- [ ] **Offline Banner**: Add a subtle toast or banner when device loses internet connectivity to prevent silent action failures.
- [ ] **Haptic Feedback**: Add `expo-haptics` triggers on key booking status transitions (`confirmed`, `completed`, `no_show`).

---

## 3. Packaging into Standalone Android `.apk`

An `.apk` allows direct sideloading and internal testing on any physical Android device without needing approval from Google Play Console. (Google Play Store distribution requires `.aab`, which is configured in the same file).

### Step 1: EAS Configuration (`apps/partner/eas.json`)

Created `apps/partner/eas.json` with the `preview` profile specifying `"buildType": "apk"`:

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Step 2: Initialize EAS & Project ID

From the `apps/partner` directory:

```bash
# 1. Log in to your Expo account (create one free at https://expo.dev if needed)
npx eas-cli@latest login

# 2. Initialize the project (links project and writes projectId into app.json)
npx eas-cli@latest init
```

### Step 3: Configure Environment Variables

Set your hosted production Supabase credentials in EAS Secrets or via the CLI:

```bash
# Set production Supabase URL & Anon Key for cloud builds
npx eas-cli@latest secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://<project-ref>.supabase.co --type string
npx eas-cli@latest secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key> --type string
```

*(Never upload the `service_role` key to the partner app).*

### Step 4: Run the Cloud Build for `.apk`

Execute the build command:

```bash
cd apps/partner
npx eas-cli@latest build --platform android --profile preview
```

**What EAS does automatically**:
1. Packages the workspace code and monorepo dependencies (`@cape001/core`, `@cape001/db`).
2. Configures native Android Gradle project with Hermes JS engine.
3. Automatically generates and securely stores an Android release keystore in Expo's cloud vault (first run).
4. Compiles and signs the standalone `.apk`.
5. Outputs a direct download link and terminal QR code.

---

## 4. Installing and Testing on Android Devices

### Method 1: QR Code / Mobile Download (Recommended)
1. Open the camera or browser on an Android smartphone.
2. Scan the QR code displayed at the end of the EAS build.
3. Tap **Download .apk** and open the downloaded file.
4. If prompted, allow "Install unknown apps" for your browser.
5. Launch **Cape 001 Partner**.

### Method 2: ADB Sideload (USB Cable)
```bash
adb install -r path/to/cape001-partner.apk
```

---

## 5. Physical Device Verification Checklist

- [ ] **Login & OTP**: Log in using a test number (`+91 99999 99999` with `123456`) or real SMS OTP.
- [ ] **Push Permission Prompt**: Confirm native permission prompt appears and token is stored (`push_tokens` table in Supabase).
- [ ] **GPS Location Capture**: Open "Create Shop" or "Shop Settings" → tap "Use my current location" → verify coordinates are captured within ~10–20 metres.
- [ ] **Photo Upload**: Upload a shop banner image from the device camera/gallery → verify image is compressed to WebP and uploaded to Supabase Storage bucket `shop-photos`.
- [ ] **Push Notification Alert**: Trigger a new customer booking from `apps/web` → verify the partner app displays a banner with sound.
- [ ] **Notification Tap Route**: Tap the notification banner → verify the app opens directly to that booking's detail screen.
