import Link from "next/link";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Container from "@/components/ui/container";
import AddToCartButton from "@/components/cart/add-to-cart-button";
import { formatNaira } from "@/lib/format/money";
import type { Product } from "@/lib/types/product";

export default function ProductDetail({ product }: { product: Product }) {
  const inStock = product.inventoryQuantity > 0;

  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <div className="border-b border-neutral-200 bg-neutral-950 px-4 py-2 text-center text-xs font-medium tracking-wide text-white">
        Free delivery on orders over ₦100,000
      </div>
      <header className="border-b border-black/10">
        <Container className="flex items-center justify-between py-5">
          <Link href="/" className="text-xl font-black tracking-[-0.05em]">JKSTORE</Link>
          <Link href="/cart" className="text-sm font-semibold underline underline-offset-4">Bag</Link>
        </Container>
      </header>

      <section className="py-10 md:py-16">
        <Container>
          <div className="grid gap-10 md:grid-cols-2 md:items-start md:gap-16">
            <div className={"relative aspect-[4/5] overflow-hidden rounded-3xl bg-cover bg-center " + product.visual}
              style={product.imageUrl ? { backgroundImage: `url(${product.imageUrl})` } : undefined}>
              {product.tag ? <Badge>{product.tag}</Badge> : null}
            </div>

            <div className="md:pt-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">{product.category.replace("-", " ")}</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] md:text-5xl">{product.name}</h1>
              <p className="mt-5 text-2xl font-semibold">{formatNaira(product.priceKobo)}</p>
              <p className="mt-6 max-w-xl leading-7 text-black/65">{product.description}</p>

              <div className="mt-8 rounded-2xl border border-neutral-200 p-5">
                <p className="text-sm font-semibold">{inStock ? "In stock" : "Out of stock"}</p>
                <p className="mt-1 text-sm text-black/50">
                  {inStock ? `${product.inventoryQuantity} available` : "This item is currently unavailable."}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <AddToCartButton product={product} />
                <Button href="#details" variant="secondary">Product details</Button>
              </div>

              <div id="details" className="mt-10 border-t border-neutral-200 pt-6">
                <p className="text-sm font-semibold">JKSTORE collection</p>
                <p className="mt-2 text-sm leading-6 text-black/55">
                  Product availability and pricing are supplied by JKSTORE's catalog. Final order pricing will always be calculated and verified on the server at checkout.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
