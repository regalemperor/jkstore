import Button from "@/components/ui/button";
import Container from "@/components/ui/container";

export default function Hero() {
  return (
    <section className="border-b border-neutral-200 bg-neutral-100">
      <Container className="grid min-h-[620px] gap-8 py-12 md:grid-cols-2 md:items-center md:py-20">
        <div>
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">The new standard</p>
          <h1 className="max-w-2xl text-5xl font-black leading-[0.95] tracking-[-0.06em] md:text-7xl">Everyday pieces. Made to stand out.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-neutral-600">Discover carefully selected essentials and statement pieces designed for modern everyday life.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="#shop">Shop now</Button>
            <Button href="#shop" variant="secondary">Explore collection</Button>
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
      </Container>
    </section>
  );
}
