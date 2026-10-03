"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/format/money";

type CustomerRow = {
  customerKey: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  orderCount: number;
  paidOrderCount: number;
  totalPaidKobo: number;
  firstOrderAt: string;
  lastOrderAt: string;
};

type Result = {
  customers: CustomerRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function CustomersClient() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
    });

    if (search) params.set("search", search);

    void fetch(`/api/admin/customers?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load customers.");
        return data as Result;
      })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load customers.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, search]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-black/50">Store operations</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Customers</h2>
          <p className="mt-2 text-sm text-black/55">
            Customer contacts and order history derived from completed store orders.
          </p>
        </div>
        <p className="text-sm text-black/45">
          {result ? `${result.total.toLocaleString("en-NG")} customers` : "Loading…"}
        </p>
      </div>

      <section className="mt-8 rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
        <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, email or phone…"
            maxLength={100}
            className="h-11 flex-1 rounded-xl border border-black/10 px-4 text-sm outline-none focus:border-black"
            aria-label="Search customers"
          />
          <button
            type="submit"
            className="h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white"
          >
            Search
          </button>
        </form>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-black/50">Loading customers…</div>
        ) : error ? (
          <div className="p-8">
            <p className="font-semibold">Customers could not be loaded.</p>
            <p className="mt-2 text-sm text-black/55">{error}</p>
          </div>
        ) : !result || result.customers.length === 0 ? (
          <div className="p-8">
            <p className="font-semibold">No customers found.</p>
            <p className="mt-2 text-sm text-black/50">
              Try another name, email or phone search.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-black/10 bg-neutral-50 text-xs uppercase tracking-wide text-black/45">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Orders</th>
                    <th className="px-5 py-4">Paid orders</th>
                    <th className="px-5 py-4">Paid total</th>
                    <th className="px-5 py-4">Last order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {result.customers.map((customer) => (
                    <tr key={customer.customerKey} className="hover:bg-neutral-50">
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/customers/${customer.customerKey}`}
                          className="font-semibold underline-offset-4 hover:underline"
                        >
                          {customer.customerName || "Customer"}
                        </Link>
                        <p className="mt-1 text-xs text-black/45">
                          {customer.customerEmail || customer.customerPhone || "Contact not provided"}
                        </p>
                      </td>
                      <td className="px-5 py-4">{customer.orderCount}</td>
                      <td className="px-5 py-4">{customer.paidOrderCount}</td>
                      <td className="px-5 py-4 font-semibold">
                        {formatNaira(customer.totalPaidKobo)}
                      </td>
                      <td className="px-5 py-4 text-black/55">
                        {new Date(customer.lastOrderAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-black/5 lg:hidden">
              {result.customers.map((customer) => (
                <Link
                  key={customer.customerKey}
                  href={`/admin/customers/${customer.customerKey}`}
                  className="block p-5 hover:bg-neutral-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {customer.customerName || "Customer"}
                      </p>
                      <p className="mt-1 truncate text-sm text-black/55">
                        {customer.customerEmail || customer.customerPhone || "Contact not provided"}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold">
                      {formatNaira(customer.totalPaidKobo)}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-black/50">
                    <span>{customer.orderCount} orders</span>
                    <span>·</span>
                    <span>{customer.paidOrderCount} paid</span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 p-5">
              <p className="text-sm text-black/50">
                Page {result.page} of {result.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= result.totalPages}
                  onClick={() => setPage((value) => Math.min(result.totalPages, value + 1))}
                  className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
