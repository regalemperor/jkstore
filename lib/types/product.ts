export type ProductCategory = "new-arrivals" | "men" | "women" | "accessories";

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceKobo: number;
  category: ProductCategory;
  tag?: string;
  imageUrl?: string | null;
  visual: string;
  isFeatured: boolean;
  isActive: boolean;
  inventoryQuantity: number;
};

export type Category = {
  id: ProductCategory;
  name: string;
  slug: ProductCategory;
};
