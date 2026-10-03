import { getSafeErrorDetails, logError } from "@/lib/http/logger";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGuestOrderAccessHash } from "@/lib/order-access";
import { consumeApiRateLimit } from "@/lib/http/rate-limit";
import { verifyPaystackTransaction } from "@/lib/paystack/verify";

function isSafeReference(value: string) {
  return value.length >= 8 && value.length <= 100 && /^[A-Za-z0-9._=-]+$/.test(value);
}

export async function GET(request: Request) {
  const ipRateLimit = await consumeApiRateLimit(request, "paystack-verify", 60, 20);

  if (!ipRateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many payment verification attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(ipRateLimit.retryAfterSeconds), "X-RateLimit-Remaining": "0" } },
    );
  }

  const reference = new URL(request.url).searchParams.get("reference")?.trim() ?? "";

  if (!isSafeReference(reference)) {
    return NextResponse.json({ error: "Invalid payment reference." }, { status: 400 });
  }

  try {
    const guestAccessHash = await getGuestOrderAccessHash();

    if (!guestAccessHash) {
      return NextResponse.json({ error: "Order access is not available on this device." }, { status: 403 });
    }

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

    if (verified.reference !== payment.provider_reference) {
      return NextResponse.json({ error: "Payment reference mismatch." }, { status: 409 });
    }

    const { data: accessOrder, error: accessError } = await supabase
      .from("orders")
      .select("id")
      .eq("id", payment.order_id)
      .eq("guest_access_token_hash", guestAccessHash)
      .gt("guest_access_expires_at", new Date().toISOString())
      .maybeSingle();

    if (accessError) {
      logError("paystack.verify.order_access_lookup_failed", { errorCode: accessError.code ?? null });
      return NextResponse.json({ error: "Unable to validate order access." }, { status: 500 });
    }

    if (!accessOrder) {
      return NextResponse.json({ error: "Payment reference is not associated with this checkout session." }, { status: 403 });
    }

    const { data, error } = await supabase.rpc("reconcile_paystack_payment", {
      p_order_id: payment.order_id,
      p_provider_reference: verified.reference,
      p_provider_transaction_id: verified.transactionId,
      p_amount_kobo: verified.amount,
      p_currency: verified.currency,
      p_provider_status: verified.status,
      p_metadata: verified.raw,
      p_webhook_event_key: null,
    });

    if (error || !data?.[0]) {
      logError("paystack.verify.reconciliation_failed", { errorCode: error?.code ?? null });
      return NextResponse.json({ error: "Unable to reconcile payment." }, { status: 500 });
    }

    const response = NextResponse.json({
      orderId: payment.order_id,
      status: data[0].order_status,
      paymentStatus: data[0].payment_status,
      verifiedStatus: verified.status,
    });



    return response;
  } catch (error) {
    logError("paystack.verify.unhandled_error", getSafeErrorDetails(error));
    return NextResponse.json({ error: "Unable to verify payment." }, { status: 502 });
  }
}
