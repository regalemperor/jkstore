"use client";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-neutral-50 px-5 py-16">
      <div className="mx-auto max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-black/40">
          JKSTORE · Store Admin
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          We couldn’t load this admin view.
        </h1>
        <p className="mt-3 text-sm leading-6 text-black/60">
          The store data could not be loaded right now. No sensitive server details are exposed here.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
