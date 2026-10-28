import { NextResponse } from "next/server";
import { hexEqual, hmacSha256Hex } from "@cape001/core";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  // Validate signature on the web host if secret is configured
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const expectedSig = await hmacSha256Hex(webhookSecret, rawBody);
    if (!hexEqual(expectedSig, signature)) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }
  }

  // Forward the webhook to the authoritative Supabase Edge Function
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("razorpay-webhook", {
    body: rawBody,
    headers: {
      "X-Razorpay-Signature": signature,
      "Content-Type": "application/json",
    },
  });

  if (error) {
    console.error("razorpay-webhook forward failed:", error);
    return NextResponse.json({ error: "webhook_processing_failed" }, { status: 500 });
  }

  return NextResponse.json(data ?? { received: true });
}
