import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Product, ProductCategory } from "@/lib/types/product";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_kobo: number;
  category_id: string;
  tag: string | null;
  image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  inventory_quantity: number;
};

const fallbackVisuals: Record<ProductCategory, string> = {
  "new-arrivals": "bg-gradient-to-br from-zinc-100 via-zinc-300 to-zinc-500",
  men: "bg-gradient-to-br from-stone-100 via-stone-300 to-stone-600",
  women: "bg-gradient-to-br from-rose-100 via-rose-200 to-rose-400",
  accessories: "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-700",
};

function toProduct(row: ProductRow): Product | null {
  if (!["new-arrivals", "men", "women", "accessories"].includes(row.category_id)) {
    return null;
  }

  const category = row.category_id as ProductCategory;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    priceKobo: row.price_kobo,
    category,
    tag: row.tag ?? undefined,
    imageUrl: row.image_url,
    visual: fallbackVisuals[category],
    isFeatured: row.is_featured,
    isActive: row.is_active,
    inventoryQuantity: row.inventory_quantity,
  };
}

async function getProducts(filters?: {
  category?: ProductCategory;
  featured?: boolean;
}) {
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("products")
    .select(
      "id,name,slug,description,price_kobo,category_id,tag,image_url,is_featured,is_active,inventory_quantity",
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (filters?.category) {
    query = query.eq("category_id", filters.category);
  }

  if (filters?.featured) {
    query = query.eq("is_featured", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load products: ${error.message}`);
  }

  return (data as ProductRow[]).map(toProduct).filter((product): product is Product => product !== null);
}

export const supabaseProductRepository = {
  async getAllProducts() {
    return getProducts();
  },

  async getFeaturedProducts() {
    return getProducts({ featured: true });
  },

  async getProductsByCategory(category: ProductCategory) {
    return getProducts({ category });
  },

  async getProductBySlug(slug: string) {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from("products")
      .select(
        "id,name,slug,description,price_kobo,category_id,tag,image_url,is_featured,is_active,inventory_quantity",
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load product: ${error.message}`);
    }

    return data ? toProduct(data as ProductRow) : null;
  },
};
