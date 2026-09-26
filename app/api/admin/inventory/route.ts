import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { getAdminInventory } from "@/lib/admin/inventory";

export async function GET(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const url = new URL(request.url);

  try {
    const result = await getAdminInventory({
      page: Number(url.searchParams.get("page") ?? "1"),
      pageSize: Number(url.searchParams.get("pageSize") ?? "25"),
      search: url.searchParams.get("search") ?? "",
      active: url.searchParams.get("active") ?? "",
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Admin inventory list failed:", error);
    return NextResponse.json(
      { error: "Unable to load inventory." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
