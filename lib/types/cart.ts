export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  priceKobo: number;
  quantity: number;
  inventoryQuantity: number;
  imageUrl?: string | null;
  visual: string;
};
