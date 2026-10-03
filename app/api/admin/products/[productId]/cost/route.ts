import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }) {
  const { admin, response } = await requireAdminApi();
  if (response) return response;
  if (!admin || admin.role !== "owner") return error("Owner access required.", 403);

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return error("Forbidden.", 403);

  const { productId } = await context.params;
  if (!UUID_RE.test(productId)) return error("Invalid product ID.", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON.", 400);
  }

  if (!body || typeof body !== "object") return error("Invalid cost data.", 400);
  const value = body as Record<string, unknown>;
  const costKobo = typeof value.costKobo === "number" ? value.costKobo : NaN;
  if (!Number.isSafeInteger(costKobo) || costKobo < 0) return error("Invalid cost amount.", 400);

  const supabase = createSupabaseAdminClient();
  const { data, error: rpcError } = await supabase.rpc("owner_set_product_cost", {
    p_product_id: productId,
    p_cost_kobo: costKobo,
    p_actor_id: admin.id,
  });

  if (rpcError) {
    if (rpcError.message.includes("Product not found")) return error("Product not found.", 404);
    if (rpcError.message.includes("Owner access required")) return error("Owner access required.", 403);
    return error("Unable to update product cost.", 500);
  }

  return NextResponse.json(
    { product: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
