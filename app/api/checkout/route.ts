import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CheckoutRequest = {
  items?: Array<{ productId?: string; quantity?: number }>;
  customer?: {
    email?: string;
    name?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
    };
  };
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutRequest;
    const items = Array.isArray(body.items)
      ? body.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
      : [];

    const customer = body.customer;
    const idempotencyKey = body.idempotencyKey;

    if (!items.length || !customer || !idempotencyKey) {
      return NextResponse.json({ error: "Missing checkout information." }, { status: 400 });
    }

    if (items.some((item) => typeof item.productId !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100)) {
      return NextResponse.json({ error: "Invalid cart items." }, { status: 400 });
    }

    if (typeof customer.email !== "string" || typeof customer.name !== "string") {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_pending_order", {
      p_items: items,
      p_customer_email: customer.email.trim(),
      p_customer_name: customer.name.trim(),
      p_customer_phone: customer.phone?.trim() ?? "",
      p_shipping_address: customer.address ?? {},
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      console.error("Checkout order creation failed:", error.message);
      return NextResponse.json({ error: error.message || "Unable to create order." }, { status: 409 });
    }

    const order = Array.isArray(data) ? data[0] : data;
    if (!order?.order_id || typeof order.total_kobo !== "number" || !order.payment_reference) {
      return NextResponse.json({ error: "Invalid checkout response." }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.order_id,
      totalKobo: order.total_kobo,
      paymentReference: order.payment_reference,
      paymentStatus: "pending",
    });
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }
}
