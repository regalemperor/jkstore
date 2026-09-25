"use client";

import { useState } from "react";
import Link from "next/link";

const sections = [
  { label: "Dashboard", href: "/admin", active: true },
  { label: "Orders", href: "/admin/orders", active: false },
  { label: "Inventory", href: "/admin/inventory", active: false },
  { label: "Products", href: "/admin/products", active: false },
  { label: "Customers", href: "/admin/customers", active: false },
];

export default function AdminMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="admin-mobile-menu"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold"
      >
        Menu
      </button>

      {open ? (
        <div
          id="admin-mobile-menu"
          className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-black/10 bg-white p-3 shadow-xl"
        >
          {sections.map((section) =>
            section.active ? (
              <Link
                key={section.label}
                href={section.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
              >
                {section.label}
              </Link>
            ) : (
              <div
                key={section.label}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-black/35"
              >
                <span>{section.label}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide">Next</span>
              </div>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
