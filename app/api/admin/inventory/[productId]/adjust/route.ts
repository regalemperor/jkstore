import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const REASONS = new Set([
  "stock_received",
  "stock_count_correction",
  "damaged_or_lost",
  "returned_stock",
  "manual_correction",
]);

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const { productId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const quantityDelta = Number(input.quantityDelta);
  const reason = typeof input.reason === "string" ? input.reason : "";
  const note = typeof input.note === "string" ? input.note.slice(0, 1000) : null;
  const reference = typeof input.reference === "string" ? input.reference.slice(0, 200) : null;
  const idempotencyKey = typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim() : "";

  if (!Number.isSafeInteger(quantityDelta) || quantityDelta === 0) {
    return NextResponse.json({ error: "Quantity must be a non-zero integer." }, { status: 400 });
  }
  if (!REASONS.has(reason)) {
    return NextResponse.json({ error: "Invalid adjustment reason." }, { status: 400 });
  }
  if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return NextResponse.json({ error: "Invalid idempotency key." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("admin_adjust_inventory", {
      p_product_id: productId,
      p_quantity_delta: quantityDelta,
      p_reason: reason,
      p_note: note,
      p_reference: reference,
      p_idempotency_key: idempotencyKey,
      p_actor_id: admin!.id,
      p_actor_role: admin!.role,
    });

    if (error) {
      console.error("Inventory adjustment failed:", error);
      const message = error.message || "Unable to adjust inventory.";
      const status =
        message.includes("below active reservations") ||
        message.includes("cannot be negative") ||
        message.includes("Unsupported") ||
        message.includes("cannot be zero")
          ? 409
          : message.includes("authorization")
            ? 403
            : 400;
      return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(
      { adjustment: data?.[0] ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Inventory adjustment request failed:", error);
    return NextResponse.json(
      { error: "Unable to adjust inventory." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
