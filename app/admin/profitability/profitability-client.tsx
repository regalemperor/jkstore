"use client";

import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/format/money";

type Period = "24h" | "7d" | "30d" | "1y";
type Report = {
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

const periods: Array<{ key: Period; label: string }> = [
  { key: "24h", label: "24 hours" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "1 month" },
  { key: "1y", label: "1 year" },
];

function margin(revenue: number, profit: number) {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

export default function ProfitabilityClient() {
  const [period, setPeriod] = useState<Period>("30d");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/admin/profitability?period=${period}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load profitability.");
        if (!cancelled) setReport(data);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Unable to load profitability.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [period]);

  const grossMargin = report ? margin(report.revenueKobo, report.grossProfitKobo) : 0;
  const afterFeeMargin = report ? margin(report.revenueKobo, report.profitAfterPaymentFeesKobo) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-black/50">Owner-only business intelligence</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Profitability</h2>
          <p className="mt-2 text-sm text-black/55">Private store economics: revenue, product cost, gross profit, margins and payment fees.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periods.map((item) => (
            <button key={item.key} type="button" onClick={() => setPeriod(item.key)} className={period === item.key ? "rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white" : "rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold"}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="mt-8 rounded-3xl border border-black/10 bg-white p-8 text-sm text-black/50">Loading private profitability data…</div> :
      error ? <div className="mt-8 rounded-3xl border border-black/10 bg-white p-8"><p className="font-semibold">Profitability could not be loaded.</p><p className="mt-2 text-sm text-black/55">{error}</p></div> :
      report ? <>
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Revenue", formatNaira(report.revenueKobo)],
            ["COGS", formatNaira(report.cogsKobo)],
            ["Gross profit", formatNaira(report.grossProfitKobo)],
            ["After payment fees", formatNaira(report.profitAfterPaymentFeesKobo)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-sm text-black/50">{label}</p>
              <p className="mt-3 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-black/10 bg-white p-5"><p className="text-sm text-black/50">Gross margin</p><p className="mt-2 text-2xl font-semibold">{grossMargin.toFixed(1)}%</p></div>
          <div className="rounded-3xl border border-black/10 bg-white p-5"><p className="text-sm text-black/50">Margin after payment fees</p><p className="mt-2 text-2xl font-semibold">{afterFeeMargin.toFixed(1)}%</p></div>
          <div className="rounded-3xl border border-black/10 bg-white p-5"><p className="text-sm text-black/50">Payment fees</p><p className="mt-2 text-2xl font-semibold">{formatNaira(report.paymentFeesKobo)}</p></div>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-black/10 bg-white p-5"><p className="text-sm text-black/50">Successful orders</p><p className="mt-2 text-2xl font-semibold">{report.orderCount.toLocaleString()}</p></div>
          <div className="rounded-3xl border border-black/10 bg-white p-5"><p className="text-sm text-black/50">Units sold</p><p className="mt-2 text-2xl font-semibold">{report.unitsSold.toLocaleString()}</p></div>
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
          <div className="border-b border-black/10 p-5"><h3 className="font-semibold">Product profitability</h3><p className="mt-1 text-sm text-black/50">Products with recorded cost snapshots in successful orders.</p></div>
          {report.products.length === 0 ? <p className="p-5 text-sm text-black/50">No costed product sales in this period yet.</p> :
          <div className="divide-y divide-black/5">
            {report.products.map((product) => (
              <div key={product.productId ?? product.productName} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                <div><p className="font-semibold">{product.productName}</p><p className="mt-1 text-xs text-black/45">{product.unitsSold.toLocaleString()} units</p></div>
                <div><p className="text-xs text-black/45">Revenue</p><p className="font-semibold">{formatNaira(product.revenueKobo)}</p></div>
                <div><p className="text-xs text-black/45">Profit</p><p className="font-semibold">{formatNaira(product.grossProfitKobo)}</p></div>
                <div><p className="text-xs text-black/45">Margin</p><p className="font-semibold">{margin(product.revenueKobo, product.grossProfitKobo).toFixed(1)}%</p></div>
              </div>
            ))}
          </div>}
        </section>
      </> : null}
    </div>
  );
}
