"use client";

import { useState } from "react";
import { useCart } from "./cart-provider";
import type { Product } from "@/lib/types/product";

export default function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const inStock = product.inventoryQuantity > 0;

  function handleAdd() {
    if (!inStock) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      priceKobo: product.priceKobo,
      inventoryQuantity: product.inventoryQuantity,
      imageUrl: product.imageUrl,
      visual: product.visual,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <button type="button" onClick={handleAdd} disabled={!inStock}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-50">
      {!inStock ? "Out of stock" : added ? "Added to bag ✓" : "Add to bag"}
    </button>
  );
}
