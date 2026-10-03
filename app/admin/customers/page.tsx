import { requireAdmin } from "@/lib/auth/admin";
import AdminShell from "@/app/admin/admin-shell";
import CustomersClient from "@/app/admin/customers/customers-client";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const admin = await requireAdmin();

  return (
    <AdminShell
      email={admin.email}
      role={admin.role}
      activeSection="Customers"
    >
      <CustomersClient />
    </AdminShell>
  );
}
