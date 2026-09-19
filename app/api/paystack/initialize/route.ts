import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status !== "pending_payment" || order.payment_status !== "pending") {
      return NextResponse.json({ error: "Order is not payable." }, { status: 409 });
    }

    const amount = Number(order.total_kobo);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid order amount." }, { status: 409 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "Payment service is not configured." }, { status: 503 });
    }

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: order.customer_email,
        amount: String(amount),
        currency: "NGN",
        reference: order.payment_reference,
        callback_url: `${new URL(request.url).origin}/checkout/complete`,
        metadata: {
          order_id: order.id,
        },
      }),
      cache: "no-store",
    });

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData?.status || !paystackData?.data?.authorization_url) {
      console.error("Paystack initialization failed:", paystackData?.message ?? "Unknown error");
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
