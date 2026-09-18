import { products } from "@/lib/data/products";
import type { Product, ProductCategory } from "@/lib/types/product";

export interface ProductRepository {
  getFeaturedProducts(): Promise<Product[]>;
  getProductsByCategory(category: ProductCategory): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
}

export const productRepository: ProductRepository = {
  async getFeaturedProducts() {
    return products.filter((product) => product.isActive && product.isFeatured);
  },
  async getProductsByCategory(category) {
    return products.filter((product) => product.isActive && product.category === category);
  },
  async getProductBySlug(slug) {
    return products.find((product) => product.isActive && product.slug === slug) ?? null;
  },
};
