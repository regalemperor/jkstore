"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartItem } from "@/lib/types/cart";

const STORAGE_KEY = "jkstore_cart_v1";
type AddCartItem = Omit<CartItem, "quantity"> & { quantity?: number };
type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotalKobo: number;
  addItem: (item: AddCartItem) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};
const CartContext = createContext<CartContextValue | null>(null);

function clampQuantity(quantity: number, inventoryQuantity: number) {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(0, Math.min(Math.floor(quantity), inventoryQuantity));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CartItem[];
        if (Array.isArray(parsed)) {
          setItems(parsed.filter((item) =>
            item && typeof item.productId === "string" && typeof item.name === "string" &&
            Number.isInteger(item.priceKobo) && item.priceKobo >= 0 &&
            Number.isInteger(item.quantity) && item.quantity > 0
          ).map((item) => ({ ...item, quantity: clampQuantity(item.quantity, item.inventoryQuantity) }))
            .filter((item) => item.quantity > 0));
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((item: AddCartItem) => {
    setItems((current) => {
      const existing = current.find((entry) => entry.productId === item.productId);
      const quantity = clampQuantity((existing?.quantity ?? 0) + (item.quantity ?? 1), item.inventoryQuantity);
      if (quantity === 0) return current;
      if (!existing) return [...current, { ...item, quantity }];
      return current.map((entry) => entry.productId === item.productId ? { ...entry, ...item, quantity } : entry);
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) => current.map((item) =>
      item.productId === productId ? { ...item, quantity: clampQuantity(quantity, item.inventoryQuantity) } : item
    ).filter((item) => item.quantity > 0));
  }, []);

  const removeItem = useCallback((productId: string) => setItems((current) => current.filter((item) => item.productId !== productId)), []);
  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(() => ({
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotalKobo: items.reduce((total, item) => total + item.priceKobo * item.quantity, 0),
    addItem, updateQuantity, removeItem, clearCart,
  }), [items, addItem, updateQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
