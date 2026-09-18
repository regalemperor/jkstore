import Container from "@/components/ui/container";

const navItems = ["New arrivals", "Men", "Women", "Accessories"];

export default function SiteHeader() {
  return (
    <header className="border-b border-black/10 bg-white">
      <Container className="flex items-center justify-between py-5">
        <a href="/" className="text-xl font-black tracking-[-0.05em]">JKSTORE</a>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => <a key={item} href="#shop" className="text-sm font-medium transition-opacity hover:opacity-60">{item}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Search" className="min-h-11 rounded-full px-3 text-lg hover:bg-black/5">⌕</button>
          <button type="button" aria-label="Account" className="min-h-11 rounded-full px-3 text-lg hover:bg-black/5">♙</button>
          <button type="button" aria-label="Shopping bag" className="min-h-11 rounded-full px-3 text-sm font-semibold hover:bg-black/5">Bag</button>
        </div>
      </Container>
    </header>
  );
}
