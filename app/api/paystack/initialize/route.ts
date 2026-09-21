import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RequestBody = {
  orderId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, payment_status, total_kobo, customer_email, payment_reference")
      .eq("id", body.orderId)
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

    const amount = Number(order.total_kobo);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid order amount." }, { status: 409 });
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
      console.error("Paystack initialization failed: PAYSTACK_SECRET_KEY is missing.");
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
        amount: String(amount),
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
          amount_kobo: amount,
          currency: "NGN",
          status: "pending",
          verification_metadata: {
            access_code: paystackData.data.access_code,
          },
        },
        { onConflict: "provider_reference" },
      );

    if (transactionError) {
      console.error("Payment transaction record failed:", transactionError.message);
      return NextResponse.json({ error: "Unable to record payment transaction." }, { status: 500 });
    }

    return NextResponse.json({
      authorizationUrl: paystackData.data.authorization_url,
      accessCode: paystackData.data.access_code,
      reference: order.payment_reference,
    });
  } catch (error) {
    console.error("Paystack initialization error:", error);
    return NextResponse.json({ error: "Unable to initialize payment." }, { status: 500 });
  }
}
