import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const ADMIN_ORDER_PAGE_SIZE = 25;
export const ADMIN_ORDER_MAX_PAGE_SIZE = 100;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdminOrderListFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
};

export type AdminOrderListItem = {
  id: string;
  status: string;
  paymentStatus: string;
  totalKobo: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  createdAt: string;
  updatedAt: string;
};

function normalizePage(value: number | undefined) {
  return Math.max(1, Number.isFinite(value) ? Math.floor(value as number) : 1);
}

function normalizePageSize(value: number | undefined) {
  return Math.min(
    ADMIN_ORDER_MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(value) ? Math.floor(value as number) : ADMIN_ORDER_PAGE_SIZE),
  );
}

function sanitizeSearch(value: string) {
  return value
    .trim()
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

export async function getAdminOrders(filters: AdminOrderListFilters = {}) {
  const supabase = createSupabaseAdminClient();
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const search = sanitizeSearch(filters.search ?? "");

  let query = supabase
    .from("orders")
    .select(
      "id, status, payment_status, total_kobo, customer_name, customer_email, customer_phone, created_at, updated_at, payment_reference",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters.status && ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"].includes(filters.status)) {
    query = query.eq("status", filters.status);
  }

  if (
    filters.paymentStatus &&
    ["pending", "success", "failed", "reversed", "refunded"].includes(filters.paymentStatus)
  ) {
    query = query.eq("payment_status", filters.paymentStatus);
  }

  if (search) {
    const exactOrderId = UUID_RE.test(search) ? search : null;
    if (exactOrderId) {
      query = query.eq("id", exactOrderId);
    } else {
      query = query.or(
        `payment_reference.ilike.%${search}%,customer_email.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`,
      );
    }
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error("Unable to load admin orders.");
  }

  return {
    orders: (data ?? []).map((order) => ({
      id: order.id,
      status: order.status,
      paymentStatus: order.payment_status,
      totalKobo: Number(order.total_kobo),
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    })),
    page,
    pageSize,
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function getAdminOrderDetail(orderId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, status, payment_status, currency, subtotal_kobo, shipping_kobo, discount_kobo, total_kobo, customer_email, customer_name, customer_phone, shipping_address, payment_reference, created_at, updated_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw new Error("Unable to load order.");
  if (!order) return null;

  const [itemsResult, paymentsResult, eventsResult] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, product_id, product_name, unit_price_kobo, quantity, line_total_kobo")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("payment_transactions")
      .select(
        "id, provider, provider_reference, provider_transaction_id, amount_kobo, order_amount_kobo, expected_customer_charge_kobo, fee_mode, provider_fee_kobo, currency, status, verified_at, created_at, updated_at",
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_events")
      .select("id, event_type, actor_type, actor_id, metadata, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
  ]);

  if (itemsResult.error || paymentsResult.error || eventsResult.error) {
    throw new Error("Unable to load order details.");
  }

  return {
    order: {
      id: order.id,
      status: order.status,
      paymentStatus: order.payment_status,
      currency: order.currency,
      subtotalKobo: Number(order.subtotal_kobo),
      shippingKobo: Number(order.shipping_kobo),
      discountKobo: Number(order.discount_kobo),
      totalKobo: Number(order.total_kobo),
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      shippingAddress: order.shipping_address,
      paymentReference: order.payment_reference,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    },
    items: (itemsResult.data ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      unitPriceKobo: Number(item.unit_price_kobo),
      quantity: item.quantity,
      lineTotalKobo: Number(item.line_total_kobo),
    })),
    payments: (paymentsResult.data ?? []).map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      providerReference: payment.provider_reference,
      providerTransactionId: payment.provider_transaction_id,
      amountKobo: Number(payment.amount_kobo),
      orderAmountKobo: Number(payment.order_amount_kobo),
      expectedCustomerChargeKobo: Number(payment.expected_customer_charge_kobo),
      feeMode: payment.fee_mode,
      providerFeeKobo:
        payment.provider_fee_kobo === null ? null : Number(payment.provider_fee_kobo),
      currency: payment.currency,
      status: payment.status,
      verifiedAt: payment.verified_at,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
    })),
    events: eventsResult.data ?? [],
  };
}
