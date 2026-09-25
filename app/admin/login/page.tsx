"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.startsWith("/admin/") ? searchParams.get("next")! : "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Invalid admin credentials.");
      setLoading(false);
      return;
    }

    window.location.assign(nextPath);
  }

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">JKSTORE</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="mt-3 text-black/60">
          Authorized store operators only.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-3xl border border-black/10 p-6">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
