import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { getAdminProduct } from "@/lib/admin/products";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function parseProductInput(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const slug = typeof value.slug === "string" ? value.slug.trim().toLowerCase() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const categoryId = typeof value.categoryId === "string" ? value.categoryId.trim() : "";
  const tag = value.tag === null || value.tag === undefined ? null : typeof value.tag === "string" ? value.tag.trim() : undefined;
  const imageUrl = value.imageUrl === null || value.imageUrl === undefined ? null : typeof value.imageUrl === "string" ? value.imageUrl.trim() : undefined;
  const priceKobo = typeof value.priceKobo === "number" ? value.priceKobo : NaN;
  const isFeatured = typeof value.isFeatured === "boolean" ? value.isFeatured : null;
  const isActive = typeof value.isActive === "boolean" ? value.isActive : null;

  if (!name || name.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 200) return null;
  if (description.length > 5000 || !categoryId || categoryId.length > 100) return null;
  if (tag !== null && (tag === undefined || tag.length > 100)) return null;
  if (imageUrl !== null && (imageUrl === undefined || imageUrl.length > 2000)) return null;
  if (!Number.isSafeInteger(priceKobo) || priceKobo < 0 || isFeatured === null || isActive === null) return null;

  return { name, slug, description, priceKobo, categoryId, tag: tag || null, imageUrl: imageUrl || null, isFeatured, isActive };
}

export async function GET(request: Request, context: { params: Promise<{ productId: string }> }) {
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const { productId } = await context.params;
  if (!UUID_RE.test(productId)) return error("Invalid product ID.", 400);

  try {
    const data = await getAdminProduct(productId, admin?.role === "owner");
    if (!data) return error("Product not found.", 404);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return error("Unable to load product.", 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }) {
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return error("Forbidden.", 403);

  const { productId } = await context.params;
  if (!UUID_RE.test(productId)) return error("Invalid product ID.", 400);

  let body: unknown;
  try { body = await request.json(); } catch { return error("Invalid JSON.", 400); }

  const input = parseProductInput(body);
  if (!input) return error("Invalid product data.", 400);

  const supabase = createSupabaseAdminClient();
  const { data, error: rpcError } = await supabase.rpc("admin_save_product", {
    p_product_id: productId,
    p_name: input.name,
    p_slug: input.slug,
    p_description: input.description,
    p_price_kobo: input.priceKobo,
    p_category_id: input.categoryId,
    p_tag: input.tag,
    p_image_url: input.imageUrl,
    p_is_featured: input.isFeatured,
    p_is_active: input.isActive,
    p_actor_id: admin.id,
    p_actor_role: admin.role,
  });

  if (rpcError) {
    if (rpcError.message.includes("Product not found")) return error("Product not found.", 404);
    if (rpcError.message.includes("already exists")) return error("A product with that name or slug already exists.", 409);
    if (rpcError.message.includes("Category")) return error("The selected category does not exist.", 409);
    return error("Unable to update product.", 500);
  }

  return NextResponse.json({ product: data }, { headers: { "Cache-Control": "no-store" } });
}
