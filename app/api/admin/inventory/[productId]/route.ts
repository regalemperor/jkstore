import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/admin";
import { getInventoryHistory } from "@/lib/admin/inventory";

export async function GET(
  request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const { productId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }

  try {
    const history = await getInventoryHistory(productId);
    return NextResponse.json(
      { history },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin inventory history failed:", error);
    return NextResponse.json(
      { error: "Unable to load inventory history." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
