import Link from "next/link";
import Container from "@/components/ui/container";

export default function ProductNotFound() {
  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <Container className="flex min-h-screen flex-col items-center justify-center text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/50">404</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Product not found</h1>
        <p className="mt-4 max-w-md text-black/55">This product may have been removed or is no longer available.</p>
        <Link href="/" className="mt-8 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white">Return to shop</Link>
      </Container>
    </main>
  );
}
