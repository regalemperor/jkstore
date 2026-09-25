import { requireAdmin } from "@/lib/auth/admin";
import AdminLogout from "@/app/admin/admin-logout";
import AdminShell from "@/app/admin/admin-shell";
import { getAdminDashboardMetrics } from "@/lib/admin/dashboard";

export const dynamic = "force-dynamic";

function formatNaira(kobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

export default async function AdminHomePage() {
  const admin = await requireAdmin();
  const metrics = await getAdminDashboardMetrics();

  return (
    <AdminShell email={admin.email} role={admin.role}>
      <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-black/50">{admin.email ?? "authorized operator"} · {admin.role}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Store overview</h2>
          <p className="mt-2 text-sm text-black/55">Operational view of orders, payments, fulfillment and inventory health.</p>
        </div>
        <AdminLogout />
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Revenue", formatNaira(metrics.revenueKobo), "Successful orders"],
          ["Orders", metrics.totalOrders.toLocaleString("en-NG"), "All orders"],
          ["Pending payments", metrics.pendingPayments.toLocaleString("en-NG"), "Awaiting confirmation"],
          ["Stock alerts", (metrics.inventory.lowStockProducts + metrics.inventory.outOfStockProducts).toLocaleString("en-NG"), "Low or out of stock"],
        ].map(([label, value, note]) => (
          <article key={label} className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
            <p className="text-sm text-black/50">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-black/45">{note}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Fulfillment</h3>
          <p className="mt-1 text-sm text-black/50">Current order lifecycle</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(metrics.fulfillment).map(([status, count]) => (
              <div key={status} className="rounded-2xl border border-black/8 p-4">
                <p className="text-xs capitalize text-black/45">{status}</p>
                <p className="mt-2 text-xl font-semibold">{count}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Inventory health</h3>
          <p className="mt-1 text-sm text-black/50">Active stock signals</p>
          <div className="mt-6 space-y-3">
            <div className="flex justify-between rounded-2xl bg-neutral-50 p-4 text-sm"><span>Low-stock products</span><strong>{metrics.inventory.lowStockProducts}</strong></div>
            <div className="flex justify-between rounded-2xl bg-neutral-50 p-4 text-sm"><span>Out-of-stock products</span><strong>{metrics.inventory.outOfStockProducts}</strong></div>
            <div className="flex justify-between rounded-2xl bg-neutral-50 p-4 text-sm"><span>Reserved units</span><strong>{metrics.inventory.reservedUnits}</strong></div>
          </div>
        </article>
      </section>
      </div>
    </AdminShell>
  );
}
