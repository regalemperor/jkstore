import Link from "next/link";
import type { ReactNode } from "react";
import AdminMobileNav from "@/app/admin/admin-mobile-nav";

const sections = [
  { label: "Dashboard", href: "/admin", enabled: true },
  { label: "Orders", href: "/admin/orders", enabled: false },
  { label: "Inventory", href: "/admin/inventory", enabled: false },
  { label: "Products", href: "/admin/products", enabled: false },
  { label: "Customers", href: "/admin/customers", enabled: false },
];

export default function AdminShell({ email, role, children }: { email: string | null; role: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-black/10 bg-white lg:block">
        <div className="flex h-full flex-col p-5">
          <div><p className="text-xs font-bold uppercase tracking-[0.3em] text-black/45">JKSTORE</p><p className="mt-1 text-lg font-semibold">Store Admin</p></div>
          <nav aria-label="Admin sections" className="mt-10 space-y-1">
            {sections.map((section) => section.enabled ? (
              <Link key={section.label} href={section.href} aria-current="page" className="block rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white">{section.label}</Link>
            ) : (
              <div key={section.label} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-black/35" aria-disabled="true"><span>{section.label}</span><span className="text-[10px] font-bold uppercase tracking-wide">Coming next</span></div>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl bg-neutral-100 p-4"><p className="truncate text-sm font-semibold">{email ?? "Admin"}</p><p className="mt-1 text-xs uppercase tracking-wide text-black/45">{role}</p></div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-black/10 bg-white/90 px-5 py-4 backdrop-blur lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-black/40">Store operations</p><h1 className="mt-1 text-xl font-semibold">Dashboard</h1></div>
            <div className="flex items-center gap-2"><AdminMobileNav /><Link href="/" className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-neutral-50">View store</Link></div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
