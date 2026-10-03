"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/format/money";

type Detail = {
  order: {
    id: string; status: string; paymentStatus: string; currency: string;
    subtotalKobo: number; shippingKobo: number; discountKobo: number; totalKobo: number;
    customerEmail: string | null; customerName: string | null; customerPhone: string | null;
    shippingAddress: Record<string, unknown> | null; paymentReference: string | null;
    createdAt: string; updatedAt: string;
  };
  items: Array<{ id: string; productId: string | null; productName: string; unitPriceKobo: number; quantity: number; lineTotalKobo: number }>;
  payments: Array<{ id: string; provider: string; providerReference: string; providerTransactionId: string | null; amountKobo: number; orderAmountKobo: number; expectedCustomerChargeKobo: number; feeMode: string; providerFeeKobo: number | null; currency: string; status: string; verifiedAt: string | null; createdAt: string; }>;
  events: Array<{ id: string; event_type: string; actor_type: string; actor_id: string | null; metadata: Record<string, unknown> | null; created_at: string }>;
};

function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function badge(value: string) { return "inline-flex rounded-full border border-black/10 px-2.5 py-1 text-xs font-semibold"; }

const nextStatus: Record<string, string | null> = {
  paid: "processing",
  processing: "shipped",
  shipped: "delivered",
};

export default function OrderAdminDetailClient({ orderId }: { orderId: string; role: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load order.");
      setDetail(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load order.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [orderId]);

  async function advance() {
    if (!detail) return;
    const target = nextStatus[detail.order.status];
    if (!target) return;

    setUpdating(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update order.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update order.");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <div className="rounded-3xl border border-black/10 bg-white p-8 text-sm text-black/50">Loading order…</div>;
  if (error && !detail) return <div className="rounded-3xl border border-black/10 bg-white p-8"><p className="font-semibold">Order could not be loaded.</p><p className="mt-2 text-sm text-black/55">{error}</p><Link href="/admin/orders" className="mt-6 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">Back to orders</Link></div>;
  if (!detail) return null;

  const { order, items, payments, events } = detail;
  const address = order.shippingAddress ?? {};
  const target = nextStatus[order.status];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="text-sm font-semibold underline underline-offset-4">← Orders</Link>
          <h2 className="mt-3 break-all text-3xl font-semibold tracking-tight">{order.id}</h2>
          <p className="mt-2 text-sm text-black/50">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        {target ? (
          <button type="button" disabled={updating} onClick={() => void advance()} className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {updating ? "Updating…" : `Mark as ${label(target)}`}
          </button>
        ) : null}
      </div>

      {error ? <div role="alert" className="mt-5 rounded-2xl border border-black/10 bg-neutral-50 p-4 text-sm">{error}</div> : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-2"><span className={badge(order.paymentStatus)}>{label(order.paymentStatus)}</span><span className={badge(order.status)}>{label(order.status)}</span></div>
            <h3 className="mt-6 text-lg font-semibold">Items</h3>
            <div className="mt-4 divide-y divide-black/5">
              {items.map((item) => <div key={item.id} className="flex justify-between gap-5 py-4 first:pt-0 last:pb-0"><div><p className="font-medium">{item.productName}</p><p className="mt-1 text-sm text-black/50">{item.quantity} × {formatNaira(item.unitPriceKobo)}</p></div><p className="font-semibold">{formatNaira(item.lineTotalKobo)}</p></div>)}
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Customer & delivery</h3>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 text-sm">
              <div><p className="text-xs uppercase tracking-wide text-black/40">Customer</p><p className="mt-2 font-semibold">{order.customerName || "—"}</p><p className="mt-1 text-black/55">{order.customerEmail || "—"}</p><p className="mt-1 text-black/55">{order.customerPhone || "—"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-black/40">Address</p><p className="mt-2 text-black/65">{String(address.line1 ?? "")}</p><p className="text-black/65">{String(address.line2 ?? "")}</p><p className="text-black/65">{[address.city, address.state].filter(Boolean).map(String).join(", ")}</p></div>
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Order timeline</h3>
            <div className="mt-5 space-y-5">
              {events.map((event) => <div key={event.id} className="flex gap-4"><div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-black" /><div><p className="font-medium">{label(event.event_type)}</p><p className="mt-1 text-xs text-black/45">{event.actor_type} · {new Date(event.created_at).toLocaleString()}</p></div></div>)}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Order summary</h3>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-black/55">Subtotal</span><span>{formatNaira(order.subtotalKobo)}</span></div>
              <div className="flex justify-between"><span className="text-black/55">Shipping</span><span>{formatNaira(order.shippingKobo)}</span></div>
              <div className="flex justify-between"><span className="text-black/55">Discount</span><span>−{formatNaira(order.discountKobo)}</span></div>
              <div className="flex justify-between border-t border-black/10 pt-4 font-bold"><span>Total</span><span>{formatNaira(order.totalKobo)}</span></div>
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Payment</h3>
            {payments.length === 0 ? <p className="mt-4 text-sm text-black/50">No payment transaction record.</p> : payments.map((payment) => <div key={payment.id} className="mt-5 rounded-2xl bg-neutral-50 p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-black/50">Status</span><strong>{label(payment.status)}</strong></div><div className="mt-2 flex justify-between gap-4"><span className="text-black/50">Charged</span><strong>{formatNaira(payment.amountKobo)}</strong></div><div className="mt-2 flex justify-between gap-4"><span className="text-black/50">Order amount</span><span>{formatNaira(payment.orderAmountKobo)}</span></div><div className="mt-2 flex justify-between gap-4"><span className="text-black/50">Fee mode</span><span>{label(payment.feeMode)}</span></div><div className="mt-3 break-all text-xs text-black/45">Ref: {payment.providerReference}</div></div>)}
          </section>
        </aside>
      </div>
    </div>
  );
}
