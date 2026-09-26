"use client";

import { useState } from "react";

export default function AdminLogout() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    const response = await fetch("/auth/signout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      setLoading(false);
      return;
    }

    window.location.assign("/admin/login");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold disabled:opacity-50"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
