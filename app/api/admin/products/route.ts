import { NextResponse } from "next/server";
import { getSafeErrorDetails, logError } from "@/lib/http/logger";
import { requireAdminApi } from "@/lib/auth/admin";
import { getAdminProducts } from "@/lib/admin/products";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
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

  if (!name || name.length > 200) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 200) return null;
  if (description.length > 5000 || !categoryId || categoryId.length > 100) return null;
  if (tag !== null && (tag === undefined || tag.length > 100)) return null;
  if (imageUrl !== null && (imageUrl === undefined || imageUrl.length > 2000)) return null;
  if (!Number.isSafeInteger(priceKobo) || priceKobo < 0 || isFeatured === null || isActive === null) return null;

  return { name, slug, description, priceKobo, categoryId, tag: tag || null, imageUrl: imageUrl || null, isFeatured, isActive };
}

export async function GET(request: Request) {
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const url = new URL(request.url);
  try {
    const data = await getAdminProducts({
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 25),
      search: url.searchParams.get("search") ?? "",
      active: url.searchParams.get("active") ?? "",
      includeCost: admin.role === "owner",
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("Unable to load products.", 500);
  }
}

export async function POST(request: Request) {
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return jsonError("Forbidden.", 403);

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Invalid JSON."); }

  const input = parseProductInput(body);
  if (!input) return jsonError("Invalid product data.");

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("admin_save_product", {
      p_product_id: null,
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

    if (error) {
      if (error.message.includes("already exists")) return jsonError("A product with that name or slug already exists.", 409);
      if (error.message.includes("Category")) return jsonError("The selected category does not exist.", 409);
      return jsonError("Unable to create product.", 500);
    }

    return NextResponse.json({ product: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("Unable to create product.", 500);
  }
}
