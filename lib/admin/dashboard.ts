import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminDashboardMetrics = {
  revenueKobo: number;
  totalOrders: number;
  pendingPayments: number;
  fulfillment: {
    paid: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    refunded: number;
  };
  inventory: {
    lowStockProducts: number;
    outOfStockProducts: number;
    reservedUnits: number;
  };
  recentActivity: Array<{
    id: string;
    orderId: string;
    eventType: string;
    actorType: string;
    createdAt: string;
  }>;
};

const LOW_STOCK_THRESHOLD = 5;

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const supabase = createSupabaseAdminClient();

  const [
    revenueResult,
    ordersResult,
    pendingResult,
    fulfillmentResult,
    inventoryResult,
    reservationResult,
    activityResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("total_kobo")
      .eq("payment_status", "success"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "pending"),
    supabase
      .from("orders")
      .select("status"),
    supabase
      .from("products")
      .select("inventory_quantity, is_active"),
    supabase
      .from("inventory_reservations")
      .select("quantity")
      .eq("status", "reserved")
      .gt("expires_at", new Date().toISOString()),
    supabase
      .from("order_events")
      .select("id, order_id, event_type, actor_type, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const firstError =
    revenueResult.error ??
    ordersResult.error ??
    pendingResult.error ??
    fulfillmentResult.error ??
    inventoryResult.error ??
    reservationResult.error ??
    activityResult.error;

  if (firstError) {
    throw new Error("Unable to load admin dashboard metrics.");
  }

  const revenueKobo = (revenueResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.total_kobo ?? 0),
    0,
  );

  const fulfillment = {
    paid: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    refunded: 0,
  };

  for (const row of fulfillmentResult.data ?? []) {
    if (row.status in fulfillment) {
      fulfillment[row.status as keyof typeof fulfillment] += 1;
    }
  }

  const activeProducts = (inventoryResult.data ?? []).filter(
    (product) => product.is_active,
  );

  const lowStockProducts = activeProducts.filter(
    (product) =>
      Number(product.inventory_quantity ?? 0) > 0 &&
      Number(product.inventory_quantity ?? 0) <= LOW_STOCK_THRESHOLD,
  ).length;

  const outOfStockProducts = activeProducts.filter(
    (product) => Number(product.inventory_quantity ?? 0) === 0,
  ).length;

  const reservedUnits = (reservationResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.quantity ?? 0),
    0,
  );

  return {
    revenueKobo,
    totalOrders: ordersResult.count ?? 0,
    pendingPayments: pendingResult.count ?? 0,
    fulfillment,
    inventory: {
      lowStockProducts,
      outOfStockProducts,
      reservedUnits,
    },
    recentActivity: (activityResult.data ?? []).map((event) => ({
      id: event.id,
      orderId: event.order_id,
      eventType: event.event_type,
      actorType: event.actor_type,
      createdAt: event.created_at,
    })),
  };
}
