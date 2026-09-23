import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CheckoutItem = { productId?: string; quantity?: number };
type ValidCheckoutItem = { productId: string; quantity: number };

type CheckoutRequest = {
  items?: CheckoutItem[];
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

function isValidCheckoutItem(item: CheckoutItem): item is ValidCheckoutItem {
  const quantity = item.quantity;

  return (
    typeof item.productId === "string" &&
    typeof quantity === "number" &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= 100
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutRequest;
    const items = Array.isArray(body.items) ? body.items : [];

    const customer = body.customer;
    const idempotencyKey = body.idempotencyKey;

    if (!items.length || !customer || !idempotencyKey) {
      return NextResponse.json({ error: "Missing checkout information." }, { status: 400 });
    }

    if (!items.every(isValidCheckoutItem)) {
      return NextResponse.json({ error: "Invalid cart items." }, { status: 400 });
    }

    if (typeof customer.email !== "string" || typeof customer.name !== "string") {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    const guestAccessToken = randomBytes(32).toString("base64url");
    const guestAccessTokenHash = createHash("sha256")
      .update(guestAccessToken, "utf8")
      .digest("hex");
    const guestAccessExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_pending_order", {
      p_items: items,
      p_customer_email: customer.email.trim(),
      p_customer_name: customer.name.trim(),
      p_customer_phone: customer.phone?.trim() ?? "",
      p_shipping_address: customer.address ?? {},
      p_idempotency_key: idempotencyKey,
      p_guest_access_token_hash: guestAccessTokenHash,
      p_guest_access_expires_at: guestAccessExpiresAt,
    });

    if (error) {
      console.error("Checkout order creation failed:", error.message);
      return NextResponse.json({ error: error.message || "Unable to create order." }, { status: 409 });
    }

    const order = Array.isArray(data) ? data[0] : data;
    const totalKobo = Number(order?.total_kobo);

    if (!order?.order_id || !Number.isSafeInteger(totalKobo) || totalKobo < 0 || !order.payment_reference) {
      return NextResponse.json({ error: "Invalid checkout response." }, { status: 500 });
    }

    const response = NextResponse.json({
      orderId: order.order_id,
      totalKobo,
      paymentReference: order.payment_reference,
      paymentStatus: "pending",
    });

    response.cookies.set({
      name: "__Host-jkstore-order-access",
      value: guestAccessToken,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }
}
