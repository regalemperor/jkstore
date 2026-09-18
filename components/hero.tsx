export default function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-2 md:items-center md:py-20 lg:px-8">
      <div>
        <p className="mb-5 text-xs font-bold uppercase tracking-[0.25em] text-black/50">The new standard</p>
        <h1 className="max-w-2xl text-5xl font-black tracking-[-0.06em] md:text-7xl">Everyday pieces. Made to stand out.</h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-black/60">Discover carefully selected essentials and statement pieces designed for modern everyday life.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#shop" className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white">Shop now</a>
          <a href="#shop" className="rounded-full border border-black/15 px-6 py-3 text-sm font-semibold">Explore collection</a>
        </div>
      </div>
      <div className="min-h-[420px] rounded-[2rem] bg-black p-8 text-white md:min-h-[520px]">
        <div className="flex h-full flex-col justify-between">
          <span className="text-xs tracking-[0.3em] text-white/50">JKSTORE / 01</span>
          <div>
            <p className="text-7xl font-black tracking-[-0.08em] md:text-9xl">CURATED</p>
            <p className="mt-3 text-sm text-white/50">Essentials for the everyday.</p>
          </div>
        </div>
      </div>
    </section>
  );
}