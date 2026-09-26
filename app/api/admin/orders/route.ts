import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { getAdminOrders } from "@/lib/admin/orders";

export async function GET(request: Request) {
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "25");

  try {
    const result = await getAdminOrders({
      page,
      pageSize,
      search: url.searchParams.get("search") ?? "",
      status: url.searchParams.get("status") ?? "",
      paymentStatus: url.searchParams.get("paymentStatus") ?? "",
    });

    return NextResponse.json(
      { ...result, role: admin!.role },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin orders list failed:", error);
    return NextResponse.json(
      { error: "Unable to load orders." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
