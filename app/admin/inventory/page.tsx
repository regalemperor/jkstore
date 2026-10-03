import { requireAdmin } from "@/lib/auth/admin";
import AdminShell from "@/app/admin/admin-shell";
import InventoryClient from "@/app/admin/inventory/inventory-client";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const admin = await requireAdmin();

  return (
    <AdminShell email={admin.email} role={admin.role} activeSection="Inventory">
      <InventoryClient />
    </AdminShell>
  );
}
