import Container from "@/components/ui/container";
import ProductCard from "@/components/product-card";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { productRepository } from "@/lib/data/product-repository";
import { formatNaira } from "@/lib/format/money";

export const metadata = {
  title: "Shop | JKSTORE",
  description: "Browse the JKSTORE collection.",
};

export default async function ProductsPage() {
  const products = await productRepository.getAllProducts();

  return (
    <div className="min-h-screen bg-white text-black">
      <SiteHeader />

      <main>
        <section className="border-b border-black/10 py-14 md:py-20">
          <Container>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">
              Shop
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] md:text-6xl">
              All products
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/60 md:text-lg">
              Explore the current JKSTORE collection and find your next everyday
              essential.
            </p>
          </Container>
        </section>

        <section className="py-14 md:py-16">
          <Container>
            {products.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={{
                      slug: product.slug,
                      name: product.name,
                      price: formatNaira(product.priceKobo),
                      tag: product.tag ?? "JKSTORE",
                      visual: product.visual,
                      imageUrl: product.imageUrl,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-black/10 px-6 py-16 text-center">
                <h2 className="text-xl font-bold">No products available</h2>
                <p className="mt-2 text-sm text-black/50">
                  Check back soon for new JKSTORE products.
                </p>
              </div>
            )}
          </Container>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
