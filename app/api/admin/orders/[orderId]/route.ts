import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { getAdminOrderDetail } from "@/lib/admin/orders";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const { orderId } = await params;

  if (!isUuid(orderId)) {
    return NextResponse.json(
      { error: "Order not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await getAdminOrderDetail(orderId);

    if (!result) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Admin order detail failed:", error);
    return NextResponse.json(
      { error: "Unable to load order." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
