import Link from "next/link";
import Container from "@/components/ui/container";
import CartButton from "@/components/cart/cart-button";

const navItems = [
  { label: "New arrivals", href: "/products?category=new-arrivals" },
  { label: "Men", href: "/products?category=men" },
  { label: "Women", href: "/products?category=women" },
  { label: "Accessories", href: "/products?category=accessories" },
];

export default function SiteHeader() {
  return (
    <header className="border-b border-black/10 bg-white">
      <Container className="flex items-center justify-between py-5">
        <Link href="/" className="text-xl font-black tracking-[-0.05em]">JKSTORE</Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className="text-sm font-medium transition-opacity hover:opacity-60">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Search" className="min-h-11 rounded-full px-3 text-lg hover:bg-black/5">⌕</button>
          <button type="button" aria-label="Account" className="min-h-11 rounded-full px-3 text-lg hover:bg-black/5">♙</button>
          <CartButton />
        </div>
      </Container>
    </header>
  );
}
