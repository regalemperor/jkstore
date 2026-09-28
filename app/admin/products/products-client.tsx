"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { formatNaira } from "@/lib/format/money";

type Category = { id: string; name: string; slug: string };
type Product = {
  id: string; name: string; slug: string; description: string; priceKobo: number; costKobo: number | null;
  categoryId: string; tag: string | null; imageUrl: string | null; isFeatured: boolean;
  isActive: boolean; inventoryQuantity: number; createdAt: string; updatedAt: string;
};
type Result = { products: Product[]; categories: Category[]; page: number; pageSize: number; total: number; totalPages: number };
type FormState = {
  name: string; slug: string; description: string; priceNaira: string; costNaira: string; categoryId: string;
  tag: string; imageUrl: string; isFeatured: boolean; isActive: boolean;
};
const emptyForm: FormState = {
  name: "", slug: "", description: "", priceNaira: "", costNaira: "", categoryId: "", tag: "",
  imageUrl: "", isFeatured: false, isActive: true,
};

function toForm(product: Product): FormState {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    priceNaira: (product.priceKobo / 100).toString(),
    costNaira: product.costKobo === null ? "" : (product.costKobo / 100).toString(),
    categoryId: product.categoryId,
    tag: product.tag ?? "",
    imageUrl: product.imageUrl ?? "",
    isFeatured: product.isFeatured,
    isActive: product.isActive,
  };
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200);
}

export default function ProductsClient({ canManage }: { canManage: boolean }) {
  const [result, setResult] = useState<Result | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (search) params.set("search", search);
      if (active) params.set("active", active);
      const response = await fetch(`/api/admin/products?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load products.");
      setResult(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [page, search, active]);

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm);
    setSaveError(null);
  }

  function openEdit(product: Product) {
    setCreating(false);
    setEditing(product);
    setForm(toForm(product));
    setSaveError(null);
  }

  function closeEditor() {
    if (!saving) {
      setCreating(false);
      setEditing(null);
      setSaveError(null);
    }
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);

    const priceNaira = Number(form.priceNaira);
    const priceKobo = Math.round(priceNaira * 100);
    if (!Number.isFinite(priceNaira) || priceNaira < 0 || !Number.isSafeInteger(priceKobo)) {
      setSaveError("Enter a valid price in naira.");
      setSaving(false);
      return;
    }

    const costNaira = Number(form.costNaira);
    const hasCost = form.costNaira.trim() !== "";
    const costKobo = Math.round(costNaira * 100);
    if (hasCost && (!Number.isFinite(costNaira) || costNaira < 0 || !Number.isSafeInteger(costKobo))) {
      setSaveError("Enter a valid cost in naira, or leave it blank if the cost is not yet known.");
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      description: form.description,
      priceKobo,
      categoryId: form.categoryId,
      tag: form.tag || null,
      imageUrl: form.imageUrl || null,
      isFeatured: form.isFeatured,
      isActive: form.isActive,
    };

    try {
      const url = creating ? "/api/admin/products" : `/api/admin/products/${editing?.id}`;
      const response = await fetch(url, {
        method: creating ? "POST" : "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save product.");

      if (hasCost && (data.product?.id || editing?.id)) {
        const productId = data.product?.id || editing?.id;
        const costResponse = await fetch(`/api/admin/products/${productId}/cost`, {
          method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ costKobo }),
        });
        const costData = await costResponse.json();
        if (!costResponse.ok) throw new Error(costData.error || "Product saved, but cost could not be updated.");
      }

      closeEditor();
      await load();
    } catch (requestError) {
      setSaveError(requestError instanceof Error ? requestError.message : "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-black/50">Store catalogue</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Products</h2>
          <p className="mt-2 text-sm text-black/55">Create and maintain catalogue details, pricing and visibility.</p>
        </div>
        {canManage ? <button type="button" onClick={openCreate} className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">Add product</button> : <span className="rounded-xl border border-black/10 px-4 py-3 text-sm text-black/55">Read-only access</span>}
      </div>

      <section className="mt-8 rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
        <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }} className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} placeholder="Search product name or slug…" className="h-11 rounded-xl border border-black/10 px-4 text-sm outline-none focus:border-black" />
          <select value={active} onChange={(event) => { setActive(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-black/10 px-3 text-sm">
            <option value="">All products</option><option value="active">Active only</option><option value="inactive">Inactive only</option>
          </select>
          <button type="submit" className="h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white">Search</button>
        </form>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
        {loading ? <div className="p-8 text-sm text-black/50">Loading products…</div> :
        error ? <div className="p-8"><p className="font-semibold">Products could not be loaded.</p><p className="mt-2 text-sm text-black/55">{error}</p></div> :
        !result || result.products.length === 0 ? <div className="p-8"><p className="font-semibold">No products found.</p></div> :
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-black/10 bg-neutral-50 text-xs uppercase tracking-wide text-black/45">
                <tr><th className="px-5 py-4">Product</th><th className="px-5 py-4">Price</th><th className="px-5 py-4">Cost</th><th className="px-5 py-4">Stock</th><th className="px-5 py-4">Visibility</th><th className="px-5 py-4"></th></tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {result.products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-5 py-4"><p className="font-semibold">{product.name}</p><p className="mt-1 text-xs text-black/45">{product.slug}</p></td>
                    <td className="px-5 py-4 font-semibold">{formatNaira(product.priceKobo)}</td><td className="px-5 py-4">{product.costKobo === null ? <span className="text-black/40">Not set</span> : formatNaira(product.costKobo)}</td>
                    <td className="px-5 py-4">{product.inventoryQuantity}</td>
                    <td className="px-5 py-4"><span className="rounded-full border border-black/10 px-2.5 py-1 text-xs font-semibold">{product.isActive ? "Active" : "Inactive"}{product.isFeatured ? " · Featured" : ""}</span></td>
                    <td className="px-5 py-4 text-right">{canManage ? <button type="button" onClick={() => openEdit(product)} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold">Edit</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-black/5 lg:hidden">
            {result.products.map((product) => (
              <button key={product.id} type="button" onClick={() => canManage && openEdit(product)} disabled={!canManage} className="block w-full p-5 text-left disabled:cursor-default">
                <div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{product.name}</p><p className="mt-1 text-sm text-black/45">{product.slug}</p></div><p className="font-semibold">{formatNaira(product.priceKobo)}</p></div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-black/10 px-2.5 py-1">{product.isActive ? "Active" : "Inactive"}</span><span className="rounded-full border border-black/10 px-2.5 py-1">Stock: {product.inventoryQuantity}</span>{product.isFeatured ? <span className="rounded-full border border-black/10 px-2.5 py-1">Featured</span> : null}</div>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 p-5">
            <p className="text-sm text-black/50">Page {result.page} of {result.totalPages}</p>
            <div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={page >= result.totalPages} onClick={() => setPage((v) => Math.min(result.totalPages, v + 1))} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold disabled:opacity-40">Next</button></div>
          </div>
        </>}
      </section>

      {(creating || editing) ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4 backdrop-blur-sm">
          <div className="mx-auto my-6 max-w-2xl rounded-3xl border border-black/10 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-black/50">{creating ? "New catalogue item" : "Catalogue item"}</p><h3 className="mt-1 text-2xl font-semibold">{creating ? "Add product" : "Edit product"}</h3></div><button type="button" onClick={closeEditor} className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold">Close</button></div>
            <form onSubmit={saveProduct} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-semibold">Name</span><input required value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3" /></label>
                <label className="block"><span className="text-sm font-semibold">Slug</span><input required value={form.slug} onChange={(e) => setForm({...form, slug:slugify(e.target.value)})} className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3" /></label>
              </div>
              <label className="block"><span className="text-sm font-semibold">Description</span><textarea required value={form.description} onChange={(e) => setForm({...form, description:e.target.value})} rows={4} className="mt-2 w-full rounded-xl border border-black/10 p-3" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-semibold">Price (₦)</span><input required inputMode="decimal" value={form.priceNaira} onChange={(e) => setForm({...form, priceNaira:e.target.value})} className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3" /></label>
                <label className="block"><span className="text-sm font-semibold">Cost (₦) — owner only</span><input inputMode="decimal" value={form.costNaira} onChange={(e) => setForm({...form, costNaira:e.target.value})} className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3" placeholder="e.g. 8500" /><p className="mt-1 text-xs text-black/45">Saved cost is snapshotted into future orders for accurate profit reporting.</p></label>
                <label className="block"><span className="text-sm font-semibold">Category</span><select required value={form.categoryId} onChange={(e) => setForm({...form, categoryId:e.target.value})} className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3"><option value="">Select category</option>{(result?.categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-semibold">Tag</span><input value={form.tag} onChange={(e) => setForm({...form, tag:e.target.value})} className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3" /></label>
                <label className="block"><span className="text-sm font-semibold">Image URL</span><input type="url" value={form.imageUrl} onChange={(e) => setForm({...form, imageUrl:e.target.value})} className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3" /></label>
              </div>
              <div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({...form, isFeatured:e.target.checked})} /> Featured</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({...form, isActive:e.target.checked})} /> Active</label></div>
              <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-black/55">Inventory is managed separately. Current physical stock: <strong>{editing?.inventoryQuantity ?? 0}</strong>.</div>
              {saveError ? <div className="rounded-xl border border-black/10 bg-neutral-50 p-3 text-sm">{saveError}</div> : null}
              <button disabled={saving} type="submit" className="w-full rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : creating ? "Create product" : "Save changes"}</button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
