import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPaystackTransaction } from "@/lib/paystack/verify";

function isSafeReference(value: string) {
  return value.length >= 8 && value.length <= 100 && /^[A-Za-z0-9._=-]+$/.test(value);
}

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference")?.trim() ?? "";

  if (!isSafeReference(reference)) {
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

    if (verified.reference !== payment.provider_reference) {
      return NextResponse.json({ error: "Payment reference mismatch." }, { status: 409 });
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
      console.error("Paystack reconciliation failed:", error?.message);
      return NextResponse.json({ error: "Unable to reconcile payment." }, { status: 500 });
    }

    return NextResponse.json({
      orderId: payment.order_id,
      status: data[0].order_status,
      paymentStatus: data[0].payment_status,
      verifiedStatus: verified.status,
    });
  } catch (error) {
    console.error("Paystack verification error:", error);
    return NextResponse.json({ error: "Unable to verify payment." }, { status: 502 });
  }
}
