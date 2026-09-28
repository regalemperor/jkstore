import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readTextBody, RequestBodyTooLargeError } from "@/lib/http/body";
import { consumeApiRateLimit } from "@/lib/http/rate-limit";
import { verifyPaystackTransaction } from "@/lib/paystack/verify";

function validSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const received = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return (
    received.length === expectedBuffer.length &&
    timingSafeEqual(received, expectedBuffer)
  );
}

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json({ error: "Payment service is not configured." }, { status: 503 });
  }

  const rateLimit = await consumeApiRateLimit(request, "paystack-webhook", 60, 120);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Webhook request rate limit exceeded." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  let rawBody: string;

  try {
    rawBody = await readTextBody(request, 128 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large." }, { status: 413 });
    }

    console.error("Paystack webhook body read failed:", error);
    return NextResponse.json({ error: "Unable to process webhook." }, { status: 400 });
  }

  const signature = request.headers.get("x-paystack-signature");

  if (!signature || !validSignature(rawBody, signature, secretKey)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };

  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const reference = event.data?.reference?.trim() ?? "";

  if (!reference || reference.length > 128 || !/^[A-Za-z0-9._=-]+$/.test(reference)) {
    return NextResponse.json({ error: "Invalid payment reference." }, { status: 400 });
  }

  try {
    const verified = await verifyPaystackTransaction(reference);
    const supabase = createSupabaseAdminClient();

    const { data: payment, error: paymentError } = await supabase
      .from("payment_transactions")
      .select("order_id, provider_reference")
      .eq("provider_reference", reference)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
    }

    const eventKey = createHash("sha256").update(rawBody).digest("hex");

    const { data, error } = await supabase.rpc("reconcile_paystack_payment", {
      p_order_id: payment.order_id,
      p_provider_reference: verified.reference,
      p_provider_transaction_id: verified.transactionId,
      p_amount_kobo: verified.amount,
      p_currency: verified.currency,
      p_provider_status: verified.status,
      p_metadata: verified.raw,
      p_webhook_event_key: eventKey,
    });

    if (error || !data?.[0]) {
      console.error("Paystack webhook reconciliation failed:", error?.message);
      return NextResponse.json({ error: "Unable to reconcile webhook." }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook error:", error);
    return NextResponse.json({ error: "Unable to process webhook." }, { status: 500 });
  }
}
