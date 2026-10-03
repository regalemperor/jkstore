"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Container from "@/components/ui/container";
import { formatNaira } from "@/lib/format/money";

type OrderData = {
  id: string;
  status: string;
  payment_status: string;
  currency: string;
  subtotal_kobo: number;
  shipping_kobo: number;
  discount_kobo: number;
  total_kobo: number;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  guest_access_expires_at: string | null;
};

type Item = {
  id: string;
  product_id: string | null;
  product_name: string;
  unit_price_kobo: number;
  quantity: number;
  line_total_kobo: number;
};

type Event = {
  id: string;
  event_type: string;
  actor_type: string;
  created_at: string;
};

function titleCase(value: string) {
  return value.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusCopy(order: OrderData) {
  if (order.payment_status === "success") {
    if (order.status === "delivered") return "Delivered";
    if (order.status === "shipped") return "Shipped";
    if (order.status === "processing") return "Processing";
    if (order.status === "refunded") return "Refunded";
    return "Payment confirmed";
  }

  if (order.payment_status === "failed") return "Payment failed";
  if (order.payment_status === "reversed") return "Payment reversed";
  if (order.payment_status === "refunded") return "Refunded";
  return order.status === "cancelled" ? "Order cancelled" : "Payment pending";
}

export default function OrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

      void fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Unable to load order.");
          return data;
        })
        .then((data) => {
          if (cancelled) return;
          setOrder(data.order);
          setItems(data.items ?? []);
          setEvents(data.events ?? []);
        })
        .catch((requestError) => {
          if (!cancelled) {
            setError(requestError instanceof Error ? requestError.message : "Unable to load order.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-neutral-950">
        <Container className="py-20">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">Order</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Loading your order…</h1>
        </Container>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-white text-neutral-950">
        <Container className="max-w-2xl py-20">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">Order access</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">We can’t open this order.</h1>
          <p className="mt-4 text-black/60">{error ?? "Order not found."}</p>
          <p className="mt-3 text-sm text-black/45">
            Order access is protected and tied to the secure checkout session on this device.
          </p>
          <Link href="/" className="mt-8 inline-flex min-h-11 items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white">
            Continue shopping
          </Link>
        </Container>
      </main>
    );
  }

  const address = order.shipping_address ?? {};

  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <header className="border-b border-black/10">
        <Container className="flex items-center justify-between py-5">
          <Link href="/" className="text-xl font-black tracking-[-0.05em]">JKSTORE</Link>
          <Link href="/" className="text-sm font-semibold underline underline-offset-4">Continue shopping</Link>
        </Container>
      </header>

      <section className="py-10 md:py-16">
        <Container className="max-w-5xl">
          <div className="flex flex-col gap-4 border-b border-black/10 pb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">Order</p>
              <h1 className="mt-2 break-all text-3xl font-black tracking-[-0.05em] md:text-4xl">{order.id}</h1>
              <p className="mt-3 text-black/55">{new Date(order.created_at).toLocaleString()}</p>
            </div>
            <div className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold">
              {statusCopy(order)}
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <section className="rounded-3xl border border-neutral-200 p-6">
                <h2 className="text-lg font-bold">Items</h2>
                <div className="mt-5 divide-y divide-black/10">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-5 py-4 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-semibold">{item.product_name}</p>
                        <p className="mt-1 text-sm text-black/50">
                          {item.quantity} × {formatNaira(item.unit_price_kobo)}
                        </p>
                      </div>
                      <p className="font-semibold">{formatNaira(item.line_total_kobo)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-neutral-200 p-6">
                <h2 className="text-lg font-bold">Delivery</h2>
                <div className="mt-5 space-y-2 text-sm text-black/65">
                  <p className="font-semibold text-black">{order.customer_name}</p>
                  {order.customer_phone ? <p>{order.customer_phone}</p> : null}
                  {address.line1 ? <p>{address.line1}</p> : null}
                  {address.line2 ? <p>{address.line2}</p> : null}
                  {(address.city || address.state) ? <p>{[address.city, address.state].filter(Boolean).join(", ")}</p> : null}
                </div>
              </section>

              <section className="rounded-3xl border border-neutral-200 p-6">
                <h2 className="text-lg font-bold">Order timeline</h2>
                <div className="mt-5 space-y-5">
                  {events.map((event) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-black" />
                      <div>
                        <p className="font-semibold">{titleCase(event.event_type)}</p>
                        <p className="mt-1 text-sm text-black/50">{new Date(event.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="h-fit rounded-3xl border border-neutral-200 p-6">
              <h2 className="text-lg font-bold">Order summary</h2>
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-black/55">Subtotal</span>
                  <span>{formatNaira(order.subtotal_kobo)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/55">Shipping</span>
                  <span>{formatNaira(order.shipping_kobo)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/55">Discount</span>
                  <span>−{formatNaira(order.discount_kobo)}</span>
                </div>
                <div className="flex justify-between border-t border-black/10 pt-4 text-base font-bold">
                  <span>Total</span>
                  <span>{formatNaira(order.total_kobo)}</span>
                </div>
              </div>
              <p className="mt-6 text-xs leading-5 text-black/45">
                This order view is protected by a secure, device-bound guest access token. It does not expose payment credentials or provider secrets.
              </p>
            </aside>
          </div>
        </Container>
      </section>
    </main>
  );
}
