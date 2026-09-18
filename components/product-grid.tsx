import ProductCard from "./product-card";
import Container from "@/components/ui/container";
import { productRepository } from "@/lib/data/product-repository";

export default async function ProductGrid() {
  const products = await productRepository.getFeaturedProducts();

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
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={{
                name: product.name,
                price: `₦${(product.priceKobo / 100).toLocaleString("en-NG")}`,
                tag: product.tag ?? "Featured",
                visual: product.visual,
              }}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
