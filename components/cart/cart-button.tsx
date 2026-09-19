"use client";

import Link from "next/link";
import { useCart } from "./cart-provider";

export default function CartButton() {
  const { itemCount } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={itemCount > 0 ? `Shopping bag, ${itemCount} item${itemCount === 1 ? "" : "s"}` : "Shopping bag"}
      className="min-h-11 rounded-full px-3 py-2 text-sm font-semibold hover:bg-black/5"
    >
      Bag{itemCount > 0 ? ` (${itemCount})` : ""}
    </Link>
  );
}
