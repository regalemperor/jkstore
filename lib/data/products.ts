import type { Category, Product } from "@/lib/types/product";

export const categories: Category[] = [
  { id: "new-arrivals", name: "New arrivals", slug: "new-arrivals" },
  { id: "men", name: "Men", slug: "men" },
  { id: "women", name: "Women", slug: "women" },
  { id: "accessories", name: "Accessories", slug: "accessories" },
];

export const products: Product[] = [
  {
    id: "prod_essential_tee",
    name: "Essential Tee",
    slug: "essential-tee",
    description: "A clean everyday essential.",
    priceKobo: 1800000,
    category: "new-arrivals",
    tag: "New",
    visual: "bg-gradient-to-br from-zinc-100 via-zinc-300 to-zinc-500",
    isFeatured: true,
    isActive: true,
    inventoryQuantity: 24,
  },
  {
    id: "prod_classic_overshirt",
    name: "Classic Overshirt",
    slug: "classic-overshirt",
    description: "A versatile layer for everyday wear.",
    priceKobo: 3200000,
    category: "men",
    tag: "Popular",
    visual: "bg-gradient-to-br from-stone-100 via-stone-300 to-stone-600",
    isFeatured: true,
    isActive: true,
    inventoryQuantity: 12,
  },
  {
    id: "prod_everyday_sneakers",
    name: "Everyday Sneakers",
    slug: "everyday-sneakers",
    description: "Comfort-focused everyday footwear.",
    priceKobo: 4500000,
    category: "new-arrivals",
    tag: "Featured",
    visual: "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-700",
    isFeatured: true,
    isActive: true,
    inventoryQuantity: 18,
  },
];
