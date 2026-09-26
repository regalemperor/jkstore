import AdminShell from "@/app/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/admin";
import OrderAdminDetailClient from "@/app/admin/orders/[orderId]/order-admin-detail-client";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const admin = await requireAdmin();
  const { orderId } = await params;

  return (
    <AdminShell email={admin.email} role={admin.role} activeSection="Orders">
      <OrderAdminDetailClient orderId={orderId} role={admin.role} />
    </AdminShell>
  );
}
