import type { Metadata } from "next";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Cape 001 privacy policy — how we collect, use and protect your personal information under the Digital Personal Data Protection Act, 2023.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    url: "/privacy",
    title: "Privacy Policy · Cape 001",
    description: "How Cape 001 handles your personal data under the DPDP Act.",
  },
};

export default function PrivacyPage() {
  const year = new Date().getFullYear();

  return (
    <article className="prose prose-sm sm:prose max-w-none">
      <h1>Privacy Policy</h1>
      <p className="lead">
        Cape 001 (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;the platform&rdquo;) operates the website at{" "}
        <a href={SITE_URL}>{SITE_URL}</a> and the Cape 001 Partner mobile app (together, the &ldquo;Services&rdquo;).
        This policy explains how we collect, use, store and protect personal data under the{" "}
        <strong>Digital Personal Data Protection Act, 2023</strong> (&ldquo;DPDP Act&rdquo;) and applicable Indian law.
      </p>
      <p>
        <strong>Last updated:</strong> October 2025
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li>
          <strong>Mobile number</strong> — collected at sign-up via OTP. Used to identify your account and send booking
          notifications.
        </li>
        <li>
          <strong>Name</strong> — optional; used to personalise your booking and help shops identify you.
        </li>
        <li>
          <strong>Location (approximate)</strong> — collected in-browser only when you tap &ldquo;Use my current
          location&rdquo;. Not stored on our servers.
        </li>
        <li>
          <strong>Booking data</strong> — shop, service, barber, date/time, notes, price. Retained for shop tax and
          accounting records even after account deletion (in anonymised form).
        </li>
        <li>
          <strong>Device push token</strong> — collected if you enable push notifications in the Partner app, to send
          booking alerts.
        </li>
        <li>
          <strong>Usage data</strong> — pages visited, errors, performance metrics. Collected via Google Analytics 4
          (anonymised IP).
        </li>
      </ul>

      <h2>2. How we use your data</h2>
      <ul>
        <li>To authenticate you and protect your account (OTP verification).</li>
        <li>To show you upcoming and past bookings.</li>
        <li>To notify shops and barbers of new bookings via push notification.</li>
        <li>To improve the product using anonymised analytics.</li>
      </ul>
      <p>We do not sell your personal data to third parties.</p>

      <h2>3. Data sharing</h2>
      <p>We share data only with:</p>
      <ul>
        <li>
          <strong>Supabase</strong> — database, auth and storage hosting (servers in ap-south-1, Mumbai).
        </li>
        <li>
          <strong>Expo / Firebase</strong> — delivery of push notifications to Android devices.
        </li>
        <li>
          <strong>Google Analytics</strong> — anonymised page-view data; no personally identifiable information.
        </li>
        <li>
          <strong>Shops listed on Cape 001</strong> — your name and booking details are visible to the shop you book
          with.
        </li>
      </ul>

      <h2>4. Your rights (DPDP Act)</h2>
      <ul>
        <li>
          <strong>Access</strong> — you can view all your bookings by logging in.
        </li>
        <li>
          <strong>Correction</strong> — update your name from your account settings.
        </li>
        <li>
          <strong>Erasure (account deletion)</strong> — delete your account from the &ldquo;My Bookings&rdquo; page.
          Your name and phone number are permanently removed; past bookings are retained anonymously.
        </li>
        <li>
          <strong>Nomination</strong> — you may nominate a person to exercise your rights on your behalf by contacting
          us.
        </li>
      </ul>

      <h2>5. Data retention</h2>
      <p>
        Account data is retained until you delete your account. Anonymised booking records are retained indefinitely for
        shop accounting purposes. Analytics data is retained for 14 months (Google Analytics default).
      </p>

      <h2>6. Security</h2>
      <p>
        Data is encrypted in transit (TLS 1.2+) and at rest. Authentication is OTP-only; we store no passwords. Access
        to production data is restricted to authorised personnel.
      </p>

      <h2>7. Cookies</h2>
      <p>
        We use a session cookie to keep you logged in (httpOnly, SameSite=Lax, Secure). Google Analytics sets its own
        cookies ({`_ga`}, {`_gid`}) which expire in 2 years and 24 hours respectively. No advertising or tracking cookies
        are used.
      </p>

      <h2>8. Children</h2>
      <p>
        Cape 001 is not directed at children under 18. We do not knowingly collect data from minors. If you believe a
        minor has created an account, contact us to delete it.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy. Material changes will be announced on the website. Continued use after the update
        date means you accept the revised policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        For privacy questions, data requests, or to raise a grievance under the DPDP Act, contact us at{" "}
        <a href="mailto:privacy@cape001.com">privacy@cape001.com</a>.
      </p>

      <p className="text-xs text-muted-foreground">
        &copy; {year} Cape 001. Kerala, India.
      </p>
    </article>
  );
}
