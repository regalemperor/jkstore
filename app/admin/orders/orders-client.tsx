"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { formatNaira } from "@/lib/format/money";

type OrderRow = {
  id: string;
  status: string;
  paymentStatus: string;
  totalKobo: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  createdAt: string;
};

type Result = {
  orders: OrderRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const statuses = ["", "pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];
const paymentStatuses = ["", "pending", "success", "failed", "reversed", "refunded"];

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function badge(value: string) {
  return "inline-flex rounded-full border border-black/10 px-2.5 py-1 text-xs font-semibold";
}

export default function OrdersClient() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
    });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);

    void fetch(`/api/admin/orders?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load orders.");
        return data as Result;
      })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load orders.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, search, status, paymentStatus]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-black/50">Store operations</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Orders</h2>
          <p className="mt-2 text-sm text-black/55">Search, review and move paid orders through fulfillment.</p>
        </div>
        <p className="text-sm text-black/45">{result ? `${result.total.toLocaleString("en-NG")} total` : "Loading…"}</p>
      </div>

      <section className="mt-8 rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
        <form onSubmit={submitSearch} className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
          <label className="block">
            <span className="sr-only">Search orders</span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Order ID, payment ref, customer…"
              maxLength={100}
              className="h-11 w-full rounded-xl border border-black/10 px-4 text-sm outline-none focus:border-black"
            />
          </label>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-black/10 px-3 text-sm">
            {statuses.map((value) => <option key={value} value={value}>{value ? `Order: ${label(value)}` : "All order statuses"}</option>)}
          </select>
          <select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-black/10 px-3 text-sm">
            {paymentStatuses.map((value) => <option key={value} value={value}>{value ? `Payment: ${label(value)}` : "All payment statuses"}</option>)}
          </select>
          <button type="submit" className="h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white">Search</button>
        </form>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-black/50">Loading orders…</div>
        ) : error ? (
          <div className="p-8">
            <p className="font-semibold">Orders could not be loaded.</p>
            <p className="mt-2 text-sm text-black/55">{error}</p>
          </div>
        ) : !result || result.orders.length === 0 ? (
          <div className="p-8">
            <p className="font-semibold">No orders found.</p>
            <p className="mt-2 text-sm text-black/50">Try another search or filter.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-black/10 bg-neutral-50 text-xs uppercase tracking-wide text-black/45">
                  <tr>
                    <th className="px-5 py-4">Order</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Payment</th>
                    <th className="px-5 py-4">Fulfillment</th>
                    <th className="px-5 py-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {result.orders.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50">
                      <td className="px-5 py-4"><Link href={`/admin/orders/${order.id}`} className="font-semibold underline-offset-4 hover:underline">{order.id}</Link><p className="mt-1 text-xs text-black/40">{new Date(order.createdAt).toLocaleString()}</p></td>
                      <td className="px-5 py-4"><p className="font-medium">{order.customerName || "—"}</p><p className="mt-1 text-xs text-black/45">{order.customerEmail || order.customerPhone || "—"}</p></td>
                      <td className="px-5 py-4"><span className={badge(order.paymentStatus)}>{label(order.paymentStatus)}</span></td>
                      <td className="px-5 py-4"><span className={badge(order.status)}>{label(order.status)}</span></td>
                      <td className="px-5 py-4 text-right font-semibold">{formatNaira(order.totalKobo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-black/5 lg:hidden">
              {result.orders.map((order) => (
                <Link key={order.id} href={`/admin/orders/${order.id}`} className="block p-5 hover:bg-neutral-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><p className="truncate font-semibold">{order.id}</p><p className="mt-1 text-sm text-black/55">{order.customerName || order.customerEmail || "Customer not provided"}</p></div>
                    <p className="shrink-0 font-semibold">{formatNaira(order.totalKobo)}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2"><span className={badge(order.paymentStatus)}>{label(order.paymentStatus)}</span><span className={badge(order.status)}>{label(order.status)}</span></div>
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 p-5">
              <p className="text-sm text-black/50">Page {result.page} of {result.totalPages}</p>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold disabled:opacity-40">Previous</button>
                <button type="button" disabled={page >= result.totalPages} onClick={() => setPage((value) => Math.min(result.totalPages, value + 1))} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold disabled:opacity-40">Next</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
