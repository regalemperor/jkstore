import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const ADMIN_CUSTOMER_PAGE_SIZE = 25;
export const ADMIN_CUSTOMER_MAX_PAGE_SIZE = 100;

function normalizePage(value: number | undefined) {
  return Math.max(1, Number.isFinite(value) ? Math.floor(value as number) : 1);
}

function normalizePageSize(value: number | undefined) {
  return Math.min(
    ADMIN_CUSTOMER_MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.isFinite(value)
        ? Math.floor(value as number)
        : ADMIN_CUSTOMER_PAGE_SIZE,
    ),
  );
}

function sanitizeSearch(value: string) {
  return value.trim().replace(/[%_,()]/g, " ").replace(/s+/g, " ").slice(0, 100);
}

export async function getAdminCustomers(filters: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}) {
  const supabase = createSupabaseAdminClient();
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const search = sanitizeSearch(filters.search ?? "");

  const [{ data, error }, { data: countData, error: countError }] = await Promise.all([
    supabase.rpc("admin_list_customers", {
      p_search: search || null,
      p_page: page,
      p_page_size: pageSize,
    }),
    supabase.rpc("admin_count_customers", {
      p_search: search || null,
    }),
  ]);

  if (error || countError) {
    throw new Error("Unable to load customers.");
  }

  const total = Number(countData ?? 0);

  return {
    customers: (data ?? []).map((customer) => ({
      customerKey: customer.customer_key,
      customerName: customer.customer_name,
      customerEmail: customer.customer_email,
      customerPhone: customer.customer_phone,
      orderCount: Number(customer.order_count ?? 0),
      paidOrderCount: Number(customer.paid_order_count ?? 0),
      totalPaidKobo: Number(customer.total_paid_kobo ?? 0),
      firstOrderAt: customer.first_order_at,
      lastOrderAt: customer.last_order_at,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getAdminCustomer(customerKey: string) {
  const supabase = createSupabaseAdminClient();

  const [{ data: customerData, error: customerError }, { data: ordersData, error: ordersError }] =
    await Promise.all([
      supabase.rpc("admin_get_customer", { p_customer_key: customerKey }),
      supabase.rpc("admin_get_customer_orders", {
        p_customer_key: customerKey,
        p_limit: 100,
      }),
    ]);

  if (customerError || ordersError) {
    throw new Error("Unable to load customer.");
  }

  const customer = customerData?.[0];
  if (!customer) return null;

  return {
    customer: {
      customerKey: customer.customer_key,
      customerName: customer.customer_name,
      customerEmail: customer.customer_email,
      customerPhone: customer.customer_phone,
      orderCount: Number(customer.order_count ?? 0),
      paidOrderCount: Number(customer.paid_order_count ?? 0),
      totalPaidKobo: Number(customer.total_paid_kobo ?? 0),
      firstOrderAt: customer.first_order_at,
      lastOrderAt: customer.last_order_at,
    },
    orders: (ordersData ?? []).map((order) => ({
      id: order.id,
      status: order.status,
      paymentStatus: order.payment_status,
      totalKobo: Number(order.total_kobo ?? 0),
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      createdAt: order.created_at,
    })),
  };
}
