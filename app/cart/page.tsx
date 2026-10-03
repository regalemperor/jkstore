"use client";

import Link from "next/link";
import Container from "@/components/ui/container";
import { formatNaira } from "@/lib/format/money";
import { useCart } from "@/components/cart/cart-provider";

export default function CartPage() {
  const { items, subtotalKobo, updateQuantity, removeItem, clearCart } = useCart();

  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <div className="border-b border-neutral-200 bg-neutral-950 px-4 py-2 text-center text-xs font-medium tracking-wide text-white">
        Free delivery on orders over ₦100,000
      </div>
      <header className="border-b border-black/10">
        <Container className="flex items-center justify-between py-5">
          <Link href="/" className="text-xl font-black tracking-[-0.05em]">JKSTORE</Link>
          <Link href="/" className="text-sm font-semibold underline underline-offset-4">Continue shopping</Link>
        </Container>
      </header>

      <section className="py-10 md:py-16">
        <Container>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">Your bag</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">Shopping bag</h1>
            </div>
            {items.length > 0 ? (
              <button type="button" onClick={clearCart} className="text-sm font-semibold underline underline-offset-4">Clear bag</button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-neutral-200 p-8 text-center">
              <h2 className="text-xl font-bold">Your bag is empty</h2>
              <p className="mt-2 text-sm text-black/55">Add something from the collection to get started.</p>
              <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white">Shop the collection</Link>
            </div>
          ) : (
            <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                {items.map((item) => (
                  <article key={item.productId} className="flex gap-4 rounded-3xl border border-neutral-200 p-4">
                    <Link href={`/products/${item.slug}`} className={`h-28 w-24 shrink-0 rounded-2xl bg-cover bg-center ${item.visual}`}
                      style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined} aria-label={item.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-4">
                        <div>
                          <Link href={`/products/${item.slug}`} className="font-semibold hover:underline">{item.name}</Link>
                          <p className="mt-1 text-sm text-black/50">{formatNaira(item.priceKobo)} each</p>
                        </div>
                        <p className="font-semibold">{formatNaira(item.priceKobo * item.quantity)}</p>
                      </div>
                      <div className="mt-6 flex items-center justify-between gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <span className="text-black/55">Qty</span>
                          <select value={item.quantity} onChange={(event) => updateQuantity(item.productId, Number(event.target.value))}
                            className="min-h-10 rounded-full border border-neutral-300 bg-white px-3" aria-label={`Quantity for ${item.name}`}>
                            {Array.from({ length: item.inventoryQuantity }, (_, index) => index + 1).map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
                          </select>
                        </label>
                        <button type="button" onClick={() => removeItem(item.productId)}
                          className="text-sm font-semibold underline underline-offset-4">Remove</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="h-fit rounded-3xl border border-neutral-200 p-6">
                <h2 className="text-lg font-bold">Order summary</h2>
                <div className="mt-6 flex justify-between text-sm">
                  <span className="text-black/55">Subtotal</span>
                  <span className="font-semibold">{formatNaira(subtotalKobo)}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-black/45">
                  Shipping, discounts, inventory and final pricing will be recalculated and verified on the server before payment.
                </p>
                <Link href="/checkout"
                  className="mt-6 flex w-full min-h-12 items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white">
                  Continue to checkout
                </Link>
              </aside>
            </div>
          )}
        </Container>
      </section>
    </main>
  );
}
