import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TARGET_STATUSES = new Set(["processing", "shipped", "delivered"]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { orderId } = await params;
  if (!isUuid(orderId)) {
    return NextResponse.json(
      { error: "Order not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const targetStatus =
    typeof body === "object" && body !== null && "status" in body
      ? (body as { status?: unknown }).status
      : null;

  if (typeof targetStatus !== "string" || !TARGET_STATUSES.has(targetStatus)) {
    return NextResponse.json(
      { error: "Unsupported fulfillment status." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase.rpc("admin_transition_order", {
      p_order_id: orderId,
      p_target_status: targetStatus,
      p_actor_id: admin!.id,
      p_actor_role: admin!.role,
    });

    if (error) {
      const message = error.message.toLowerCase();

      if (message.includes("not found")) {
        return NextResponse.json(
          { error: "Order not found." },
          { status: 404, headers: { "Cache-Control": "no-store" } },
        );
      }

      if (
        message.includes("invalid order status transition") ||
        message.includes("only successfully paid") ||
        message.includes("unsupported fulfillment status")
      ) {
        return NextResponse.json(
          { error: error.message },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }

      if (message.includes("admin authorization") || message.includes("admin role")) {
        return NextResponse.json(
          { error: "Admin authorization failed." },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      }

      console.error("Admin order transition failed:", error.message);
      return NextResponse.json(
        { error: "Unable to update order." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { success: true, transition: data?.[0] ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin order transition exception:", error);
    return NextResponse.json(
      { error: "Unable to update order." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
