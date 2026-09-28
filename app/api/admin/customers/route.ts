import { NextResponse } from "next/server";
import { getSafeErrorDetails, logError } from "@/lib/http/logger";

import { requireAdminApi } from "@/lib/auth/admin";
import { getAdminCustomers } from "@/lib/admin/customers";

export async function GET(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "25");

  try {
    const result = await getAdminCustomers({
      page,
      pageSize,
      search: url.searchParams.get("search") ?? "",
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    logError("admin.customers.unhandled_error", getSafeErrorDetails(error));
    return NextResponse.json(
      { error: "Unable to load customers." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
