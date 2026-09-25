import { requireAdmin } from "@/lib/auth/admin";
import AdminLogout from "@/app/admin/admin-logout";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const admin = await requireAdmin();

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">JKSTORE ADMIN</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Store operations</h1>
            <p className="mt-2 text-black/60">
              Signed in as {admin.email ?? "authorized operator"} · {admin.role}
            </p>
          </div>
          <AdminLogout />
        </div>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-black/10 p-6">
            <p className="text-sm text-black/50">Orders</p>
            <p className="mt-2 text-2xl font-semibold">Foundation ready</p>
          </div>
          <div className="rounded-3xl border border-black/10 p-6">
            <p className="text-sm text-black/50">Inventory</p>
            <p className="mt-2 text-2xl font-semibold">Foundation ready</p>
          </div>
          <div className="rounded-3xl border border-black/10 p-6">
            <p className="text-sm text-black/50">Products</p>
            <p className="mt-2 text-2xl font-semibold">Foundation ready</p>
          </div>
        </section>
      </div>
    </main>
  );
}
