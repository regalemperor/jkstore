"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Container from "@/components/ui/container";
import { useCart } from "@/components/cart/cart-provider";
import { formatNaira } from "@/lib/format/money";

export default function CheckoutPage() {
  const { items, subtotalKobo, clearCart } = useCart();
  const [status, setStatus] = useState<string | null>(null);
  const [order, setOrder] = useState<{ orderId: string; totalKobo: number; paymentReference: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Securing your order…");

    const form = new FormData(event.currentTarget);
    const payload = {
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      customer: {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        address: {
          line1: String(form.get("line1") ?? ""),
          line2: String(form.get("line2") ?? ""),
          city: String(form.get("city") ?? ""),
          state: String(form.get("state") ?? ""),
        },
      },
      idempotencyKey: crypto.randomUUID(),
    };

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create order.");

      setOrder(data);
      setStatus("Order secured. Redirecting to secure payment…");

      const paymentResponse = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: data.orderId }),
      });
      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok || !paymentData.authorizationUrl) {
        throw new Error(paymentData.error || "Unable to initialize payment.");
      }

      clearCart();
      window.location.assign(paymentData.authorizationUrl);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create order.");
    }
  }

  if (items.length === 0 && !order) {
    return (
      <main className="min-h-screen bg-white text-neutral-950">
        <Container className="py-20 text-center">
          <h1 className="text-4xl font-black tracking-[-0.05em]">Your bag is empty</h1>
          <p className="mt-3 text-black/55">Add products before starting checkout.</p>
          <Link href="/" className="mt-7 inline-flex min-h-11 items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white">Continue shopping</Link>
        </Container>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <header className="border-b border-black/10">
        <Container className="flex items-center justify-between py-5">
          <Link href="/" className="text-xl font-black tracking-[-0.05em]">JKSTORE</Link>
          <Link href="/cart" className="text-sm font-semibold underline underline-offset-4">Back to bag</Link>
        </Container>
      </header>

      <section className="py-10 md:py-16">
        <Container className="max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">Checkout</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">Delivery details</h1>

          {order ? (
            <div className="mt-8 rounded-3xl border border-neutral-200 p-7">
              <p className="text-sm font-semibold">Order created successfully.</p>
              <p className="mt-3 text-sm text-black/60">Order ID: {order.orderId}</p>
              <p className="mt-1 text-sm text-black/60">Amount secured: {formatNaira(order.totalKobo)}</p>
              <p className="mt-1 text-sm text-black/60">Payment reference: {order.paymentReference}</p>
              <p className="mt-5 text-sm leading-6 text-black/60">
                Payment is not marked as successful yet. The next step will initialize Paystack from the server and verify payment before any order is fulfilled.
              </p>
              <Link href="/" className="mt-7 inline-flex min-h-11 items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white">Continue shopping</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
              <div className="space-y-6">
                <section className="rounded-3xl border border-neutral-200 p-6">
                  <h2 className="text-lg font-bold">Contact</h2>
                  <div className="mt-5 grid gap-4">
                    <input name="name" required minLength={2} placeholder="Full name" className="min-h-12 rounded-2xl border border-neutral-300 px-4" />
                    <input name="email" required type="email" placeholder="Email address" className="min-h-12 rounded-2xl border border-neutral-300 px-4" />
                    <input name="phone" required placeholder="Phone number" className="min-h-12 rounded-2xl border border-neutral-300 px-4" />
                  </div>
                </section>

                <section className="rounded-3xl border border-neutral-200 p-6">
                  <h2 className="text-lg font-bold">Delivery address</h2>
                  <div className="mt-5 grid gap-4">
                    <input name="line1" required placeholder="Address" className="min-h-12 rounded-2xl border border-neutral-300 px-4" />
                    <input name="line2" placeholder="Apartment, suite, landmark (optional)" className="min-h-12 rounded-2xl border border-neutral-300 px-4" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input name="city" required placeholder="City" className="min-h-12 rounded-2xl border border-neutral-300 px-4" />
                      <input name="state" required placeholder="State" className="min-h-12 rounded-2xl border border-neutral-300 px-4" />
                    </div>
                  </div>
                </section>
              </div>

              <aside className="h-fit rounded-3xl border border-neutral-200 p-6">
                <h2 className="text-lg font-bold">Order summary</h2>
                <div className="mt-6 flex justify-between text-sm">
                  <span className="text-black/55">Current subtotal</span>
                  <span className="font-semibold">{formatNaira(subtotalKobo)}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-black/45">
                  The server will ignore browser prices and recalculate every product, quantity and total from the live catalog before creating the order.
                </p>
                <button type="submit" className="mt-6 w-full min-h-12 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white">
                  Secure order
                </button>
                {status ? <p className="mt-4 text-sm text-black/60">{status}</p> : null}
              </aside>
            </form>
          )}
        </Container>
      </section>
    </main>
  );
}
