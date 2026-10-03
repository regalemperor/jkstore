import AdminShell from "@/app/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/admin";
import ProfitabilityClient from "@/app/admin/profitability/profitability-client";

export const dynamic = "force-dynamic";

export default async function OwnerProfitabilityPage() {
  const admin = await requireAdmin();

  if (admin.role !== "owner") {
    return null;
  }

  return (
    <AdminShell email={admin.email} role={admin.role} activeSection="Profitability">
      <ProfitabilityClient />
    </AdminShell>
  );
}
