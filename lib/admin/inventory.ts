import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const ADMIN_INVENTORY_PAGE_SIZE = 25;
const LOW_STOCK_THRESHOLD = 5;

export type InventoryRow = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  isActive: boolean;
  inventoryQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStock: boolean;
  outOfStock: boolean;
};

export type InventoryAdjustmentRow = {
  id: string;
  productId: string;
  productName: string;
  actorId: string;
  actorRole: string;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  note: string | null;
  reference: string | null;
  createdAt: string;
};

function sanitizeSearch(value: string) {
  return value.trim().replace(/[%,_]/g, "").slice(0, 100);
}

export async function getAdminInventory(input: {
  page?: number;
  pageSize?: number;
  search?: string;
  active?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize ?? ADMIN_INVENTORY_PAGE_SIZE)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("products")
    .select("id, name, slug, category_id, is_active, inventory_quantity", { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);

  const search = sanitizeSearch(input.search ?? "");
  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  }

  if (input.active === "active") query = query.eq("is_active", true);
  if (input.active === "inactive") query = query.eq("is_active", false);

  const { data, count, error } = await query;
  if (error) throw new Error("Unable to load inventory.");

  const productIds = (data ?? []).map((product) => product.id);
  const reservations = productIds.length
    ? await supabase
        .from("inventory_reservations")
        .select("product_id, quantity")
        .in("product_id", productIds)
        .eq("status", "reserved")
        .gt("expires_at", new Date().toISOString())
    : { data: [], error: null };

  if (reservations.error) throw new Error("Unable to load inventory reservations.");

  const reservedByProduct = new Map<string, number>();
  for (const reservation of reservations.data ?? []) {
    reservedByProduct.set(
      reservation.product_id,
      (reservedByProduct.get(reservation.product_id) ?? 0) + Number(reservation.quantity ?? 0),
    );
  }

  const products: InventoryRow[] = (data ?? []).map((product) => {
    const inventoryQuantity = Number(product.inventory_quantity ?? 0);
    const reservedQuantity = reservedByProduct.get(product.id) ?? 0;
    const availableQuantity = Math.max(0, inventoryQuantity - reservedQuantity);
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      categoryId: product.category_id,
      isActive: product.is_active,
      inventoryQuantity,
      reservedQuantity,
      availableQuantity,
      lowStock: product.is_active && availableQuantity > 0 && availableQuantity <= LOW_STOCK_THRESHOLD,
      outOfStock: product.is_active && availableQuantity === 0,
    };
  });

  return {
    products,
    page,
    pageSize,
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    lowStockThreshold: LOW_STOCK_THRESHOLD,
  };
}

export async function getInventoryHistory(productId: string, limit = 25) {
  const supabase = createSupabaseAdminClient();
  const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));

  const { data, error } = await supabase
    .from("inventory_adjustments")
    .select("id, product_id, actor_id, actor_role, quantity_delta, quantity_before, quantity_after, reason, note, reference, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(boundedLimit);

  if (error) throw new Error("Unable to load inventory history.");

  return (data ?? []).map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: "Product",
    actorId: row.actor_id,
    actorRole: row.actor_role,
    quantityDelta: Number(row.quantity_delta),
    quantityBefore: Number(row.quantity_before),
    quantityAfter: Number(row.quantity_after),
    reason: row.reason,
    note: row.note,
    reference: row.reference,
    createdAt: row.created_at,
  })) as InventoryAdjustmentRow[];
}
