"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

type FormState = "idle" | "submitting" | "success" | "error";

const CONTACT_EMAIL = "hello@cape001.com";

export function ContactForm() {
  const [state, setState] = useState<FormState>("idle");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");

    // Build a mailto: link as a reliable no-backend contact method.
    // In production this can be replaced with an API route + email provider.
    const subject = encodeURIComponent(`Cape 001 enquiry from ${name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`,
    );
    const href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

    // Open the mailto link in the same tab; the form acts as a pre-fill helper.
    window.location.href = href;

    // Give the client a moment before resetting state (mailto: opens system mail app).
    setTimeout(() => setState("success"), 800);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="contact-name">Your name</Label>
        <Input
          id="contact-name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          placeholder="e.g. Arun Kumar"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-email">Email address</Label>
        <Input
          id="contact-email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="Tell us how we can help…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {state === "success" && (
        <Alert>
          <AlertDescription>
            Your mail app should open with your message pre-filled. If it didn&apos;t,{" "}
            email us directly at <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
          </AlertDescription>
        </Alert>
      )}

      {state === "error" && (
        <Alert variant="destructive">
          <AlertDescription>Something went wrong. Please email us at {CONTACT_EMAIL}.</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={state === "submitting" || state === "success"} className="w-full">
        {state === "submitting" ? "Opening mail app…" : "Send message"}
      </Button>
    </form>
  );
}
