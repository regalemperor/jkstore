import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readJsonBody, RequestBodyTooLargeError } from "@/lib/http/body";
import { consumeApiRateLimit } from "@/lib/http/rate-limit";

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
  return typeof value === "string" && value.length <= maxLength;
}

export async function POST(request: Request) {
  const rateLimit = await consumeApiRateLimit(request, "checkout", 60, 12);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

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
      typeof customer.email !== "string" ||
      customer.email.length > 254 ||
      typeof customer.name !== "string" ||
      customer.name.length > 120 ||
      !isBoundedString(idempotencyKey, 128)
    ) {
      return NextResponse.json({ error: "Invalid checkout information." }, { status: 400 });
    }

    if (
      customer.phone !== undefined &&
      !isBoundedString(customer.phone, 40)
    ) {
      return NextResponse.json({ error: "Invalid checkout information." }, { status: 400 });
    }

    const address = customer.address;
    if (
      address !== undefined &&
      (!isBoundedString(address.line1, 200) ||
        !isBoundedString(address.line2, 200) ||
        !isBoundedString(address.city, 100) ||
        !isBoundedString(address.state, 100))
    ) {
      return NextResponse.json({ error: "Invalid checkout information." }, { status: 400 });
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
      p_idempotency_key: idempotencyKey,
      p_guest_access_token_hash: guestAccessTokenHash,
      p_guest_access_expires_at: guestAccessExpiresAt,
    });

    if (error) {
      console.error("Checkout order creation failed:", error.message);
      return NextResponse.json({ error: "Unable to create order." }, { status: 409 });
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
      return NextResponse.json({ error: "Request body too large." }, { status: 413 });
    }

    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }
}
