import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Cape 001 team — questions, shop partnerships, feedback, or support.",
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    url: "/contact",
    title: "Contact · Cape 001",
    description: "Get in touch with the Cape 001 team.",
  },
};

export default function ContactPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Contact</h1>
        <p className="text-muted-foreground">
          Questions, feedback, partnership enquiries, or anything else — we&apos;re happy to hear from you.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          <ContactForm />
        </div>
        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Email</p>
            <a href="mailto:hello@cape001.com" className="hover:text-foreground transition-colors">
              hello@cape001.com
            </a>
          </div>
          <div>
            <p className="font-medium text-foreground">For shops</p>
            <p>Interested in listing your barber shop or salon? Fill in the form and mention your shop name and location.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Privacy &amp; data</p>
            <p>
              For data deletion or DPDP Act requests, you can also delete your account directly from the{" "}
              <Link href="/bookings" className="underline hover:text-foreground">My Bookings</Link> page, or email{" "}
              <a href="mailto:privacy@cape001.com" className="underline hover:text-foreground">privacy@cape001.com</a>.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Response time</p>
            <p>We aim to reply within 2 business days.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
