const navItems = ["New arrivals", "Men", "Women", "Accessories"];

export default function SiteHeader() {
  return (
    <header className="border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <a href="/" className="text-xl font-black tracking-[-0.05em]">JKSTORE</a>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a key={item} href="#shop" className="text-sm font-medium transition-opacity hover:opacity-60">{item}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Search" className="rounded-full p-2 hover:bg-black/5">⌕</button>
          <button type="button" aria-label="Account" className="rounded-full p-2 hover:bg-black/5">♙</button>
          <button type="button" aria-label="Shopping bag" className="rounded-full p-2 hover:bg-black/5">Bag</button>
        </div>
      </div>
    </header>
  );
}