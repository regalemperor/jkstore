import Hero from "@/components/hero";
import ProductGrid from "@/components/product-grid";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <div className="border-b border-neutral-200 bg-neutral-950 px-4 py-2 text-center text-xs font-medium tracking-wide text-white">
        Free delivery on orders over ₦100,000
      </div>
      <SiteHeader />
      <Hero />
      <ProductGrid />
      <SiteFooter />
    </main>
  );
}
