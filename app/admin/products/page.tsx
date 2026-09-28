import AdminShell from "@/app/admin/admin-shell";
import ProductsClient from "@/app/admin/products/products-client";
import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const admin = await requireAdmin();
  return (
    <AdminShell email={admin.email} role={admin.role} activeSection="Products">
      <ProductsClient canManage={admin.role === "owner" || admin.role === "admin"} isOwner={admin.role === "owner"} />
    </AdminShell>
  );
}
