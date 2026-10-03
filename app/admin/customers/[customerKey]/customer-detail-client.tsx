"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/format/money";

type Detail = {
  customer: {
    customerKey: string;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    orderCount: number;
    paidOrderCount: number;
    totalPaidKobo: number;
    firstOrderAt: string;
    lastOrderAt: string;
  };
  orders: Array<{
    id: string;
    status: string;
    paymentStatus: string;
    totalKobo: number;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    createdAt: string;
  }>;
};

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function badge(value: string) {
  return "inline-flex rounded-full border border-black/10 px-2.5 py-1 text-xs font-semibold";
}

export default function CustomerDetailClient({ customerKey }: { customerKey: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch(`/api/admin/customers/${encodeURIComponent(customerKey)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to load customer.");
        }
        return data as Detail;
      })
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load customer.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customerKey]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white p-8 text-sm text-black/50">
        Loading customer…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white p-8">
        <p className="font-semibold">Customer could not be loaded.</p>
        <p className="mt-2 text-sm text-black/55">
          {error || "Customer not found."}
        </p>
        <Link
          href="/admin/customers"
          className="mt-6 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          Back to customers
        </Link>
      </div>
    );
  }

  const { customer, orders } = detail;

  return (
    <div>
      <Link
        href="/admin/customers"
        className="text-sm font-semibold underline underline-offset-4"
      >
        ← Customers
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="break-words text-3xl font-semibold tracking-tight">
            {customer.customerName || "Customer"}
          </h2>
          <div className="mt-3 space-y-1 text-sm text-black/55">
            {customer.customerEmail ? <p>{customer.customerEmail}</p> : null}
            {customer.customerPhone ? <p>{customer.customerPhone}</p> : null}
          </div>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Orders", customer.orderCount.toLocaleString("en-NG")],
          ["Paid orders", customer.paidOrderCount.toLocaleString("en-NG")],
          ["Paid total", formatNaira(customer.totalPaidKobo)],
        ].map(([labelText, value]) => (
          <article
            key={labelText}
            className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-black/50">{labelText}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/10 p-6">
          <h3 className="text-lg font-semibold">Order history</h3>
          <p className="mt-1 text-sm text-black/50">
            The customer's order records remain the source of truth.
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="p-6 text-sm text-black/50">No orders found.</div>
        ) : (
          <div className="divide-y divide-black/5">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="block p-5 hover:bg-neutral-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold break-all">{order.id}</p>
                    <p className="mt-1 text-sm text-black/50">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="font-semibold">{formatNaira(order.totalKobo)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={badge(order.paymentStatus)}>
                    {label(order.paymentStatus)}
                  </span>
                  <span className={badge(order.status)}>
                    {label(order.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
