import ProductCard from "./product-card";
import Container from "@/components/ui/container";

const products = [
  { name: "Essential Tee", price: "₦18,000", tag: "New", visual: "bg-gradient-to-br from-zinc-100 via-zinc-300 to-zinc-500" },
  { name: "Classic Overshirt", price: "₦32,000", tag: "Popular", visual: "bg-gradient-to-br from-stone-100 via-stone-300 to-stone-600" },
  { name: "Everyday Sneakers", price: "₦45,000", tag: "Featured", visual: "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-700" },
];

export default function ProductGrid() {
  return (
    <section id="shop" className="py-16">
      <Container>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">Shop</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] md:text-4xl">Featured collection</h2>
          </div>
          <a href="#shop" className="hidden text-sm font-semibold underline underline-offset-4 sm:block">View all</a>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => <ProductCard key={product.name} product={product} />)}
        </div>
      </Container>
    </section>
  );
}
