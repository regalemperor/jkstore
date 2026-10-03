import AdminShell from "@/app/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/admin";
import OrdersClient from "@/app/admin/orders/orders-client";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const admin = await requireAdmin();

  return (
    <AdminShell email={admin.email} role={admin.role} activeSection="Orders">
      <OrdersClient />
    </AdminShell>
  );
}
