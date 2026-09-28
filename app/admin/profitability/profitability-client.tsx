"use client";

import { useEffect, useMemo, useState } from "react";
import { formatNaira } from "@/lib/format/money";

type Period = "24h" | "7d" | "30d" | "1y";
type TimelineMetric = "revenue" | "grossProfit" | "afterFees";

type TimelinePoint = {
  bucketAt: string;
  revenueKobo: number;
  costedRevenueKobo: number;
  cogsKobo: number;
  paymentFeesKobo: number;
  grossProfitKobo: number;
  profitAfterPaymentFeesKobo: number;
  orderCount: number;
  unitsSold: number;
  missingCostUnits: number;
};

type Report = {
  revenueKobo: number;
  costedRevenueKobo: number;
  cogsKobo: number;
  paymentFeesKobo: number;
  grossProfitKobo: number;
  profitAfterPaymentFeesKobo: number;
  orderCount: number;
  unitsSold: number;
  missingCostUnits: number;
  timeline: TimelinePoint[];
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

const timelineMetrics: Array<{ key: TimelineMetric; label: string }> = [
  { key: "revenue", label: "Revenue" },
  { key: "grossProfit", label: "Gross profit" },
  { key: "afterFees", label: "After fees" },
];

function margin(revenue: number, profit: number) {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

function metricValue(point: TimelinePoint, metric: TimelineMetric) {
  if (metric === "grossProfit") return point.grossProfitKobo;
  if (metric === "afterFees") return point.profitAfterPaymentFeesKobo;
  return point.revenueKobo;
}

function formatBucket(dateString: string, period: Period) {
  const date = new Date(dateString);
  if (period === "24h") {
    return date.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (period === "1y") {
    return date.toLocaleDateString("en-NG", { month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("en-NG", { day: "2-digit", month: "short" });
}

function TimelineChart({ points, period, metric }: { points: TimelinePoint[]; period: Period; metric: TimelineMetric }) {
  const values = points.map((point) => metricValue(point, metric));
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 760;
  const height = 230;
  const padX = 24;
  const padY = 24;
  const usableWidth = width - padX * 2;
  const usableHeight = height - padY * 2;
  const pointsString = points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : padX + (index / (points.length - 1)) * usableWidth;
      const y = padY + (1 - (metricValue(point, metric) - min) / range) * usableHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const zeroY = padY + (1 - (0 - min) / range) * usableHeight;
  const step = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 min-w-[640px] w-full" role="img" aria-label={`${timelineMetrics.find((item) => item.key === metric)?.label} timeline`}>
          <line x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="4 4" />
          <polyline points={pointsString} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => {
            const x = points.length === 1 ? width / 2 : padX + (index / (points.length - 1)) * usableWidth;
            const y = padY + (1 - (metricValue(point, metric) - min) / range) * usableHeight;
            return index % step === 0 || index === points.length - 1 ? (
              <g key={point.bucketAt}>
                <circle cx={x} cy={y} r="4" fill="currentColor" />
                <text x={x} y={height - 5} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.55">
                  {formatBucket(point.bucketAt, period)}
                </text>
              </g>
            ) : null;
          })}
        </svg>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-black/50 sm:grid-cols-3">
        <p>Peak: <span className="font-semibold text-black">{formatNaira(max)}</span></p>
        <p>Lowest: <span className="font-semibold text-black">{formatNaira(min)}</span></p>
        <p>Points: <span className="font-semibold text-black">{points.length}</span></p>
      </div>
    </div>
  );
}

export default function ProfitabilityClient() {
  const [period, setPeriod] = useState<Period>("30d");
  const [metric, setMetric] = useState<TimelineMetric>("revenue");
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
  const markup = report && report.cogsKobo > 0 ? (report.grossProfitKobo / report.cogsKobo) * 100 : 0;
  const timelineSummary = useMemo(() => {
    if (!report) return null;
    const values = report.timeline.map((point) => metricValue(point, metric));
    return {
      total: values.reduce((sum, value) => sum + value, 0),
      peak: Math.max(...values, 0),
    };
  }, [report, metric]);

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
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Revenue", formatNaira(report.revenueKobo)],
            ["Costed sales", formatNaira(report.costedRevenueKobo)],
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

        <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-black/10 bg-white p-5"><p className="text-sm text-black/50">Gross margin</p><p className="mt-2 text-2xl font-semibold">{grossMargin.toFixed(1)}%</p></div>
          <div className="rounded-3xl border border-black/10 bg-white p-5"><p className="text-sm text-black/50">Margin after payment fees</p><p className="mt-2 text-2xl font-semibold">{afterFeeMargin.toFixed(1)}%</p></div>
          <div className="rounded-3xl border border-black/10 bg-white p-5"><p className="text-sm text-black/50">Payment fees</p><p className="mt-2 text-2xl font-semibold">{formatNaira(report.paymentFeesKobo)}</p></div>
          <div className="rounded-3xl border border-black/10 bg-white p-5"><p className="text-sm text-black/50">Markup on cost</p><p className="mt-2 text-2xl font-semibold">{markup.toFixed(1)}%</p></div>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-black/10 bg-white p-5"><p className="text-sm text-black/50">Successful orders</p><p className="mt-2 text-2xl font-semibold">{report.orderCount.toLocaleString()}</p></div>
          <div className="rounded-3xl border border-black/10 bg-white p-5"><p className="text-sm text-black/50">Units sold</p><p className="mt-2 text-2xl font-semibold">{report.unitsSold.toLocaleString()}</p></div>
        </section>

        <section className="mt-8 rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Revenue & profitability timeline</p>
              <p className="mt-1 text-sm text-black/50">
                {period === "24h" ? "Hourly" : period === "1y" ? "Monthly" : "Daily"} buckets for the selected period, using Africa/Lagos time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {timelineMetrics.map((item) => (
                <button key={item.key} type="button" onClick={() => setMetric(item.key)} className={metric === item.key ? "rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white" : "rounded-xl border border-black/10 px-3 py-2 text-xs font-semibold"}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {report.timeline.length === 0 ? (
            <p className="mt-6 text-sm text-black/50">No timeline data is available for this period yet.</p>
          ) : (
            <>
              <div className="mt-5">
                <TimelineChart points={report.timeline} period={period} metric={metric} />
              </div>
              {timelineSummary && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-neutral-50 p-4">
                    <p className="text-xs text-black/45">Selected metric across period</p>
                    <p className="mt-1 text-lg font-semibold">{formatNaira(timelineSummary.total)}</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 p-4">
                    <p className="text-xs text-black/45">Peak bucket</p>
                    <p className="mt-1 text-lg font-semibold">{formatNaira(timelineSummary.peak)}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="mt-4 rounded-3xl border border-black/10 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Cost coverage</p><p className="mt-1 text-sm text-black/50">Units sold without a historical cost snapshot are excluded from COGS/profit calculations.</p></div><div className="text-right"><p className="text-2xl font-semibold">{report.missingCostUnits.toLocaleString()}</p><p className="text-xs text-black/45">uncosted units</p></div></div></section>

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
                <div><p className="text-xs text-black/45">Markup</p><p className="font-semibold">{product.cogsKobo > 0 ? ((product.grossProfitKobo / product.cogsKobo) * 100).toFixed(1) : "—"}%</p></div>
              </div>
            ))}
          </div>}
        </section>
      </> : null}
    </div>
  );
}
