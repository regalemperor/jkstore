import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  if (!isUuid(orderId)) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const token = (await cookies()).get("__Host-jkstore-order-access")?.value;

  if (!token || token.length < 40) {
    return NextResponse.json({ error: "Order access is not available on this device." }, { status: 403 });
  }

  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");

  try {
    const supabase = createSupabaseAdminClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, status, payment_status, currency, subtotal_kobo, shipping_kobo, discount_kobo, total_kobo, customer_name, customer_phone, shipping_address, created_at, updated_at, guest_access_expires_at",
      )
      .eq("id", orderId)
      .eq("guest_access_token_hash", tokenHash)
      .gt("guest_access_expires_at", new Date().toISOString())
      .maybeSingle();

    if (orderError) {
      console.error("Order access lookup failed:", orderError.message);
      return NextResponse.json({ error: "Unable to load order." }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const [{ data: items, error: itemsError }, { data: events, error: eventsError }] =
      await Promise.all([
        supabase
          .from("order_items")
          .select("id, product_id, product_name, unit_price_kobo, quantity, line_total_kobo")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true }),
        supabase
          .from("order_events")
          .select("id, event_type, actor_type, metadata, created_at")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true }),
      ]);

    if (itemsError || eventsError) {
      console.error("Order detail lookup failed:", {
        items: itemsError?.message ?? null,
        events: eventsError?.message ?? null,
      });
      return NextResponse.json({ error: "Unable to load order details." }, { status: 500 });
    }

    return NextResponse.json(
      {
        order,
        items: items ?? [],
        events: events ?? [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Order access error:", error);
    return NextResponse.json({ error: "Unable to load order." }, { status: 500 });
  }
}
