import { NextResponse } from "next/server";
import { getSafeErrorDetails, logError } from "@/lib/http/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonBody, RequestBodyTooLargeError } from "@/lib/http/body";
import { consumeApiRateLimit } from "@/lib/http/rate-limit";
import { calculateExpectedCustomerChargeKobo, getPaystackFeeMode } from "@/lib/paystack/fees";
import { getGuestOrderAccessHash, isValidOrderUuid } from "@/lib/order-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RequestBody = {
  orderId?: string;
};

export async function POST(request: Request) {
  const ipRateLimit = await consumeApiRateLimit(request, "paystack-initialize", 60, 20);

  if (!ipRateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(ipRateLimit.retryAfterSeconds),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  try {
    const body = await readJsonBody<RequestBody>(request, 8 * 1024);

    if (
      typeof body.orderId !== "string" ||
      !body.orderId.trim() ||
      body.orderId.length > 100
    ) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const orderRateLimit = await consumeApiRateLimit(
      request,
      "paystack-initialize-order",
      60,
      5,
      body.orderId.trim(),
    );

    if (!orderRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many payment attempts for this order. Please try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(orderRateLimit.retryAfterSeconds),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }

    const supabase = createSupabaseAdminClient();
    const guestAccessHash = await getGuestOrderAccessHash();

    if (!guestAccessHash) {
      return NextResponse.json({ error: "Order access is not available on this device." }, { status: 403 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, payment_status, total_kobo, customer_email, payment_reference")
      .eq("id", body.orderId.trim())
      .eq("guest_access_token_hash", guestAccessHash)
      .gt("guest_access_expires_at", new Date().toISOString())
      .single();

    if (orderError || !order) {
      console.error("Paystack initialization order lookup failed:", {
        code: orderError?.code ?? null,
        message: orderError?.message ?? "Order not found",
        details: orderError?.details ?? null,
        hint: orderError?.hint ?? null,
      });

      const isSupabaseAuthFailure =
        orderError?.code === "401" ||
        /invalid api key|jwt/i.test(orderError?.message ?? "");

      return NextResponse.json(
        {
          error: isSupabaseAuthFailure
            ? "Payment service database authentication failed."
            : "Order not found.",
        },
        { status: isSupabaseAuthFailure ? 503 : 404 },
      );
    }

    if (order.status !== "pending_payment" || order.payment_status !== "pending") {
      return NextResponse.json({ error: "Order is not payable." }, { status: 409 });
    }

    const { data: reservation, error: reservationError } = await supabase
      .from("inventory_reservations")
      .select("id")
      .eq("order_id", order.id)
      .eq("status", "reserved")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (reservationError) {
      logError("paystack.initialize.reservation_lookup_failed", { errorCode: reservationError.code ?? null });
      return NextResponse.json({ error: "Unable to validate checkout reservation." }, { status: 500 });
    }

    if (!reservation) {
      return NextResponse.json(
        { error: "Checkout session has expired. Please return to checkout and create a new order." },
        { status: 409 },
      );
    }

    const amount = Number(order.total_kobo);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid order amount." }, { status: 409 });
    }

    const feeMode = getPaystackFeeMode();
    const orderAmountKobo = BigInt(amount);
    const expectedCustomerChargeKobo =
      feeMode === "pass_to_customer"
        ? calculateExpectedCustomerChargeKobo(orderAmountKobo)
        : orderAmountKobo;
    const expectedCustomerCharge = Number(expectedCustomerChargeKobo);

    if (!Number.isSafeInteger(expectedCustomerCharge) || expectedCustomerCharge <= 0) {
      return NextResponse.json({ error: "Invalid customer charge." }, { status: 409 });
    }

    if (
      typeof order.customer_email !== "string" ||
      !order.customer_email.trim() ||
      typeof order.payment_reference !== "string" ||
      !order.payment_reference.trim()
    ) {
      return NextResponse.json({ error: "Order payment details are invalid." }, { status: 409 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!secretKey) {
      logError("paystack.initialize.missing_secret");
      return NextResponse.json({ error: "Payment service is not configured." }, { status: 503 });
    }

    const origin = new URL(request.url).origin;

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: order.customer_email.trim(),
        amount: String(expectedCustomerCharge),
        currency: "NGN",
        reference: order.payment_reference,
        callback_url: `${origin}/checkout/complete`,
        metadata: {
          order_id: order.id,
        },
      }),
      cache: "no-store",
    });

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData?.status || !paystackData?.data?.authorization_url) {
      console.error("Paystack initialization failed:", {
        status: paystackResponse.status,
        message: paystackData?.message ?? "Unknown error",
        reference: order.payment_reference,
      });
      return NextResponse.json({ error: "Unable to initialize payment." }, { status: 502 });
    }

    const { error: transactionError } = await supabase
      .from("payment_transactions")
      .upsert(
        {
          order_id: order.id,
          provider: "paystack",
          provider_reference: order.payment_reference,
          amount_kobo: expectedCustomerCharge,
          order_amount_kobo: amount,
          expected_customer_charge_kobo: expectedCustomerCharge,
          fee_mode: feeMode,
          currency: "NGN",
          status: "pending",
          verification_metadata: {
            access_code: paystackData.data.access_code,
          },
        },
        { onConflict: "provider_reference" },
      );

    if (transactionError) {
      logError("paystack.initialize.transaction_record_failed", { errorCode: transactionError.code ?? null });
      return NextResponse.json({ error: "Unable to record payment transaction." }, { status: 500 });
    }

    return NextResponse.json({
      authorizationUrl: paystackData.data.authorization_url,
      accessCode: paystackData.data.access_code,
      reference: order.payment_reference,
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large." }, { status: 413 });
    }

    logError("paystack.initialize.unhandled_error", getSafeErrorDetails(error));
    return NextResponse.json({ error: "Unable to initialize payment." }, { status: 400 });
  }
}
