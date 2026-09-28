import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProfitabilityPeriod = "24h" | "7d" | "30d" | "1y";

export type OwnerProfitabilityReport = {
  revenueKobo: number;
  cogsKobo: number;
  paymentFeesKobo: number;
  grossProfitKobo: number;
  profitAfterPaymentFeesKobo: number;
  orderCount: number;
  unitsSold: number;
  products: Array<{
    productId: string | null;
    productName: string;
    revenueKobo: number;
    cogsKobo: number;
    unitsSold: number;
    grossProfitKobo: number;
  }>;
};

function getStart(period: ProfitabilityPeriod, end: Date) {
  const start = new Date(end);
  if (period === "24h") start.setHours(start.getHours() - 24);
  if (period === "7d") start.setDate(start.getDate() - 7);
  if (period === "30d") start.setDate(start.getDate() - 30);
  if (period === "1y") start.setFullYear(start.getFullYear() - 1);
  return start;
}

export async function getOwnerProfitability(
  actorId: string,
  period: ProfitabilityPeriod,
): Promise<OwnerProfitabilityReport> {
  const end = new Date();
  const start = getStart(period, end);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc("owner_profitability_report", {
    p_start_at: start.toISOString(),
    p_end_at: end.toISOString(),
    p_actor_id: actorId,
  });

  if (error) throw new Error("Unable to load profitability report.");

  return {
    revenueKobo: Number(data?.revenueKobo ?? 0),
    cogsKobo: Number(data?.cogsKobo ?? 0),
    paymentFeesKobo: Number(data?.paymentFeesKobo ?? 0),
    grossProfitKobo: Number(data?.grossProfitKobo ?? 0),
    profitAfterPaymentFeesKobo: Number(data?.profitAfterPaymentFeesKobo ?? 0),
    orderCount: Number(data?.orderCount ?? 0),
    unitsSold: Number(data?.unitsSold ?? 0),
    products: Array.isArray(data?.products)
      ? data.products.map((product: Record<string, unknown>) => ({
          productId: typeof product.product_id === "string" ? product.product_id : null,
          productName: String(product.product_name ?? "Unknown product"),
          revenueKobo: Number(product.revenue_kobo ?? 0),
          cogsKobo: Number(product.cogs_kobo ?? 0),
          unitsSold: Number(product.units_sold ?? 0),
          grossProfitKobo: Number(product.gross_profit_kobo ?? 0),
        }))
      : [],
  };
}
