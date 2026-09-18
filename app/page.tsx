const categories = ["New arrivals", "Men", "Women", "Accessories"];

const products = [
  { name: "Essential Tee", price: "₦18,000", tag: "New" },
  { name: "Classic Overshirt", price: "₦32,000", tag: "Popular" },
  { name: "Everyday Sneakers", price: "₦45,000", tag: "Featured" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <div className="border-b border-neutral-200 bg-neutral-950 px-4 py-2 text-center text-xs font-medium tracking-wide text-white">
        Free delivery on orders over ₦100,000
      </div>

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="/" className="text-2xl font-black tracking-[-0.06em]">
            JK<span className="text-neutral-500">STORE</span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {categories.map((category) => (
              <a key={category} href="#" className="text-sm font-medium transition hover:text-neutral-500">
                {category}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button aria-label="Search" className="rounded-full p-3 text-lg transition hover:bg-neutral-100">⌕</button>
            <button aria-label="Account" className="rounded-full p-3 text-lg transition hover:bg-neutral-100">♙</button>
            <button aria-label="Shopping bag" className="rounded-full p-3 text-lg transition hover:bg-neutral-100">▢</button>
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-neutral-100">
        <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.3em] text-neutral-500">The new standard</p>
            <h1 className="max-w-xl text-5xl font-black leading-[0.95] tracking-[-0.06em] sm:text-7xl">
              Everyday pieces. Made to stand out.
            </h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-neutral-600 sm:text-lg">
              Discover carefully selected essentials and statement pieces designed for modern everyday living.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#shop" className="rounded-full bg-neutral-950 px-7 py-4 text-sm font-bold text-white transition hover:bg-neutral-800">
                Shop now
              </a>
              <a href="#featured" className="rounded-full border border-neutral-300 bg-white px-7 py-4 text-sm font-bold transition hover:bg-neutral-50">
                Explore collection
              </a>
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] bg-neutral-900 p-8 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,0.2),transparent_32%),linear-gradient(135deg,#171717,#404040)]" />
            <div className="relative flex h-full flex-col justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-neutral-300">JKSTORE / 01</span>
              <div>
                <p className="text-6xl font-black tracking-[-0.07em] sm:text-8xl">CURATED</p>
                <p className="mt-2 text-sm text-neutral-300">Style, utility &amp; quality in one place.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="featured" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">Shop</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Featured collection</h2>
          </div>
          <a href="#shop" className="hidden text-sm font-bold underline underline-offset-4 sm:block">View all</a>
        </div>

        <div id="shop" className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article key={product.name} className="group">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-100">
                <div className="absolute inset-0 bg-[linear-gradient(145deg,#e5e5e5,#b8b8b8)] transition duration-500 group-hover:scale-105" />
                <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-bold">{product.tag}</span>
                <button className="absolute bottom-4 right-4 rounded-full bg-white px-4 py-2 text-xs font-bold opacity-0 shadow-sm transition group-hover:opacity-100">
                  Quick add
                </button>
              </div>
              <div className="flex items-start justify-between gap-4 pt-4">
                <div>
                  <h3 className="font-bold">{product.name}</h3>
                  <p className="mt-1 text-sm text-neutral-500">Premium everyday essential</p>
                </div>
                <p className="font-bold">{product.price}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p className="text-xl font-black tracking-[-0.05em]">JKSTORE</p>
          <p className="text-sm text-neutral-400">Built for modern shopping.</p>
        </div>
      </footer>
    </main>
  );
}
