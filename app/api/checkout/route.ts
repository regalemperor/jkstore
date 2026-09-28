import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RequestBodyTooLargeError, readJsonBody } from "@/lib/http/body";

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
    item.productId.length <= 100 &&
    typeof quantity === "number" &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= 100
  );
}

function isBoundedString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<CheckoutRequest>(request, 32 * 1024);
    const items = Array.isArray(body.items) ? body.items : [];

    const customer = body.customer;
    const idempotencyKey = body.idempotencyKey;

    if (!items.length || items.length > 50 || !customer || !idempotencyKey) {
      return NextResponse.json({ error: "Missing checkout information." }, { status: 400 });
    }

    if (!items.every(isValidCheckoutItem)) {
      return NextResponse.json({ error: "Invalid cart items." }, { status: 400 });
    }

    if (
      !isBoundedString(customer.email, 254) ||
      !isBoundedString(customer.name, 120) ||
      !isBoundedString(idempotencyKey, 128)
    ) {
      return NextResponse.json({ error: "Invalid customer or checkout information." }, { status: 400 });
    }

    if (customer.phone !== undefined && customer.phone.length > 40) {
      return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
    }

    const address = customer.address;
    if (
      address &&
      (!isBoundedString(address.line1, 200) ||
        (address.line2 !== undefined && address.line2.length > 200) ||
        !isBoundedString(address.city, 100) ||
        !isBoundedString(address.state, 100))
    ) {
      return NextResponse.json({ error: "Invalid shipping address." }, { status: 400 });
    }

    const guestAccessToken = randomBytes(32).toString("base64url");
    const guestAccessTokenHash = createHash("sha256")
      .update(guestAccessToken, "utf8")
      .digest("hex");
    const guestAccessExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_pending_order", {
      p_items: items,
      p_customer_email: customer.email.trim(),
      p_customer_name: customer.name.trim(),
      p_customer_phone: customer.phone?.trim() ?? "",
      p_shipping_address: customer.address ?? {},
      p_idempotency_key: idempotencyKey.trim(),
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
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }

    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }
}
