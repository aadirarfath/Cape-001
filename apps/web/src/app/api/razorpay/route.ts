import { NextResponse } from "next/server";
import {
  createOrderRequestSchema,
  verifyPaymentRequestSchema,
} from "@cape001/core";
import { createClient, getUserId } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const userId = await getUserId(supabase);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action ?? (body.razorpay_signature ? "verify-payment" : "create-order");

  if (action === "create-order") {
    const parse = createOrderRequestSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parse.error.issues },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
      body: { booking_id: parse.data.booking_id },
    });

    if (error) {
      console.error("create-razorpay-order function error", error);
      return NextResponse.json(
        { error: error.message || "order_creation_failed" },
        { status: 502 },
      );
    }

    return NextResponse.json(data);
  }

  if (action === "verify-payment") {
    const parse = verifyPaymentRequestSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parse.error.issues },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.functions.invoke("verify-razorpay-payment", {
      body: parse.data,
    });

    if (error) {
      console.error("verify-razorpay-payment function error", error);
      return NextResponse.json(
        { error: error.message || "payment_verification_failed" },
        { status: 400 },
      );
    }

    return NextResponse.json(data ?? { confirmed: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    route: "/api/razorpay",
    actions: ["create-order", "verify-payment"],
  });
}
