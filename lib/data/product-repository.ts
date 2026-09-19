import { supabaseProductRepository } from "@/lib/data/supabase-product-repository";
import type { Product, ProductCategory } from "@/lib/types/product";

export interface ProductRepository {
  getFeaturedProducts(): Promise<Product[]>;
  getProductsByCategory(category: ProductCategory): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
}

export const productRepository: ProductRepository = supabaseProductRepository;
