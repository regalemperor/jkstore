"use client";
import { useState } from "react";
import Link from "next/link";
const sections = [
  { label: "Dashboard", href: "/admin", enabled: true },
  { label: "Orders", href: "/admin/orders", enabled: false },
  { label: "Inventory", href: "/admin/inventory", enabled: false },
  { label: "Products", href: "/admin/products", enabled: false },
  { label: "Customers", href: "/admin/customers", enabled: false },
];
export default function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative lg:hidden">
      <button type="button" aria-expanded={open} aria-controls="admin-mobile-menu" aria-label={open ? "Close admin menu" : "Open admin menu"} onClick={() => setOpen((value) => !value)} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold">Menu</button>
      {open ? <div id="admin-mobile-menu" className="absolute right-0 top-12 z-30 w-[min(16rem,calc(100vw-2rem))] rounded-2xl border border-black/10 bg-white p-3 shadow-xl">
        {sections.map((section) => section.enabled ? (
          <Link key={section.label} href={section.href} onClick={() => setOpen(false)} aria-current="page" className="block rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white">{section.label}</Link>
        ) : (
          <div key={section.label} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-black/35" aria-disabled="true"><span>{section.label}</span><span className="text-[10px] font-bold uppercase tracking-wide">Coming next</span></div>
        ))}
      </div> : null}
    </div>
  );
}
