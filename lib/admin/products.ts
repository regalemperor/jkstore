import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const ADMIN_PRODUCT_PAGE_SIZE = 25;
export const ADMIN_PRODUCT_MAX_PAGE_SIZE = 100;

function normalizePage(value: number | undefined) {
  return Math.max(1, Number.isFinite(value) ? Math.floor(value as number) : 1);
}

function normalizePageSize(value: number | undefined) {
  return Math.min(
    ADMIN_PRODUCT_MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(value) ? Math.floor(value as number) : ADMIN_PRODUCT_PAGE_SIZE),
  );
}

function sanitizeSearch(value: string) {
  return value.trim().replace(/[%_,]/g, " ").replace(/\s+/g, " ").slice(0, 100);
}

export async function getAdminProducts(input: {
  page?: number;
  pageSize?: number;
  search?: string;
  active?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const page = normalizePage(input.page);
  const pageSize = normalizePageSize(input.pageSize);
  const search = sanitizeSearch(input.search ?? "");

  let query = supabase
    .from("products")
    .select(
      "id, name, slug, description, price_kobo, category_id, tag, image_url, is_featured, is_active, inventory_quantity, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  if (input.active === "active") query = query.eq("is_active", true);
  if (input.active === "inactive") query = query.eq("is_active", false);

  const { data, count, error } = await query;
  if (error) throw new Error("Unable to load products.");

  const categories = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (categories.error) throw new Error("Unable to load categories.");

  return {
    products: (data ?? []).map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      priceKobo: Number(product.price_kobo),
      categoryId: product.category_id,
      tag: product.tag,
      imageUrl: product.image_url,
      isFeatured: product.is_featured,
      isActive: product.is_active,
      inventoryQuantity: Number(product.inventory_quantity),
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    })),
    categories: categories.data ?? [],
    page,
    pageSize,
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function getAdminProduct(productId: string) {
  const supabase = createSupabaseAdminClient();

  const [productResult, auditResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, slug, description, price_kobo, category_id, tag, image_url, is_featured, is_active, inventory_quantity, created_at, updated_at",
      )
      .eq("id", productId)
      .maybeSingle(),
    supabase
      .from("product_admin_events")
      .select("id, action, actor_id, actor_role, changes, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (productResult.error || auditResult.error) throw new Error("Unable to load product.");
  if (!productResult.data) return null;

  const product = productResult.data;
  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      priceKobo: Number(product.price_kobo),
      categoryId: product.category_id,
      tag: product.tag,
      imageUrl: product.image_url,
      isFeatured: product.is_featured,
      isActive: product.is_active,
      inventoryQuantity: Number(product.inventory_quantity),
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    },
    audit: auditResult.data ?? [],
  };
}
