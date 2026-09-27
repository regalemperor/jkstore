import { requireAdmin } from "@/lib/auth/admin";
import AdminShell from "@/app/admin/admin-shell";
import CustomerDetailClient from "@/app/admin/customers/[customerKey]/customer-detail-client";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerKey: string }>;
}) {
  const admin = await requireAdmin();
  const { customerKey } = await params;

  return (
    <AdminShell
      email={admin.email}
      role={admin.role}
      activeSection="Customers"
    >
      <CustomerDetailClient customerKey={customerKey} />
    </AdminShell>
  );
}
