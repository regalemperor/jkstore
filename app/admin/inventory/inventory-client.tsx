"use client";

import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/format/money";

type InventoryRow = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  isActive: boolean;
  inventoryQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStock: boolean;
  outOfStock: boolean;
};

type Result = {
  products: InventoryRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  lowStockThreshold: number;
};

type HistoryRow = {
  id: string;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  note: string | null;
  actorRole: string;
  createdAt: string;
};

const reasons = [
  ["stock_received", "Stock received"],
  ["stock_count_correction", "Stock count correction"],
  ["damaged_or_lost", "Damaged / lost"],
  ["returned_stock", "Returned stock"],
  ["manual_correction", "Manual correction"],
] as const;

function reasonLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(product: InventoryRow) {
  if (!product.isActive) return "Inactive";
  if (product.outOfStock) return "Out of stock";
  if (product.lowStock) return "Low stock";
  return "In stock";
}

export default function InventoryClient() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  async function loadInventory() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (search) params.set("search", search);
      if (active) params.set("active", active);
      const response = await fetch(`/api/admin/inventory?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load inventory.");
      setResult(data as Result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInventory();
  }, [page, search, active]);

  async function showHistory(productId: string) {
    if (expanded === productId) {
      setExpanded(null);
      return;
    }
    setExpanded(productId);
    const response = await fetch(`/api/admin/inventory/${productId}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setHistory(data.history as HistoryRow[]);
  }

  async function adjust(productId: string, form: HTMLFormElement) {
    const formData = new FormData(form);
    const quantityDelta = Number(formData.get("quantityDelta"));
    const reason = String(formData.get("reason") || "");
    const note = String(formData.get("note") || "");

    if (!Number.isSafeInteger(quantityDelta) || quantityDelta === 0) {
      setError("Enter a non-zero whole-number adjustment.");
      return;
    }

    setAdjusting(productId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/inventory/${productId}/adjust`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantityDelta,
          reason,
          note,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to adjust inventory.");
      form.reset();
      await loadInventory();
      if (expanded === productId) {
        const historyResponse = await fetch(`/api/admin/inventory/${productId}`, { cache: "no-store" });
        const historyData = await historyResponse.json();
        if (historyResponse.ok) setHistory(historyData.history as HistoryRow[]);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to adjust inventory.");
    } finally {
      setAdjusting(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-black/50">Store operations</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Inventory</h2>
          <p className="mt-2 text-sm text-black/55">Track physical stock, reservations and available units. Stock changes are audited.</p>
        </div>
        <p className="text-sm text-black/45">Low-stock threshold: {result?.lowStockThreshold ?? 5}</p>
      </div>

      <section className="mt-8 rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
        <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }} className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} placeholder="Search product name or slug…" className="h-11 rounded-xl border border-black/10 px-4 text-sm outline-none focus:border-black" />
          <select value={active} onChange={(event) => { setActive(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-black/10 px-3 text-sm">
            <option value="">All products</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <button type="submit" className="h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white">Search</button>
        </form>
      </section>

      {error && <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4 text-sm">{error}</div>}

      <section className="mt-6 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-black/50">Loading inventory…</div>
        ) : !result || result.products.length === 0 ? (
          <div className="p-8 text-sm text-black/50">No products found.</div>
        ) : (
          <div className="divide-y divide-black/5">
            {result.products.map((product) => (
              <div key={product.id} className="p-5">
                <div className="grid gap-5 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))_auto] lg:items-center">
                  <div><p className="font-semibold">{product.name}</p><p className="mt-1 text-xs text-black/45">{product.slug} · {product.categoryId}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-black/40">Physical</p><p className="mt-1 text-lg font-semibold">{product.inventoryQuantity}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-black/40">Reserved</p><p className="mt-1 text-lg font-semibold">{product.reservedQuantity}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-black/40">Available</p><p className="mt-1 text-lg font-semibold">{product.availableQuantity}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-black/40">Status</p><p className="mt-1 text-sm font-semibold">{statusLabel(product)}</p></div>
                  <button type="button" onClick={() => void showHistory(product.id)} className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold">{expanded === product.id ? "Hide history" : "History"}</button>
                </div>

                <form onSubmit={(event) => { event.preventDefault(); void adjust(product.id, event.currentTarget); }} className="mt-5 grid gap-3 lg:grid-cols-[140px_220px_1fr_auto]">
                  <input name="quantityDelta" type="number" step="1" placeholder="+10 / -2" className="h-10 rounded-xl border border-black/10 px-3 text-sm" />
                  <select name="reason" defaultValue="stock_received" className="h-10 rounded-xl border border-black/10 px-3 text-sm">
                    {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input name="note" maxLength={1000} placeholder="Optional operator note…" className="h-10 rounded-xl border border-black/10 px-3 text-sm" />
                  <button type="submit" disabled={adjusting === product.id} className="h-10 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-50">{adjusting === product.id ? "Saving…" : "Adjust stock"}</button>
                </form>

                {expanded === product.id && (
                  <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-black/45">Adjustment history</p>
                    {history.length === 0 ? <p className="mt-3 text-sm text-black/50">No adjustments recorded.</p> : (
                      <div className="mt-3 space-y-3">
                        {history.map((entry) => (
                          <div key={entry.id} className="rounded-xl border border-black/10 bg-white p-3 text-sm">
                            <div className="flex flex-wrap justify-between gap-2">
                              <span className="font-semibold">{entry.quantityDelta > 0 ? "+" : ""}{entry.quantityDelta} · {reasonLabel(entry.reason)}</span>
                              <span className="text-black/45">{new Date(entry.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="mt-1 text-black/55">{entry.quantityBefore} → {entry.quantityAfter} · {entry.actorRole}</p>
                            {entry.note && <p className="mt-1 text-black/55">{entry.note}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {result && result.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-black/10 p-5">
            <p className="text-sm text-black/50">Page {result.page} of {result.totalPages}</p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= result.totalPages} onClick={() => setPage((value) => Math.min(result.totalPages, value + 1))} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
