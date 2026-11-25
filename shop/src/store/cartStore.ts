"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  brandName: string;
  sku: string;
  imageUrl: string;
  colorName?: string;
  sizeName?: string;
  price: number;
  compareAtPrice?: number | null;
  quantity: number;
  maxStock?: number;
}

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isDrawerOpen: false,

      addItem: (incoming) =>
        set((state) => {
          const qtyToAdd = Math.max(1, incoming.quantity ?? 1);
          const existingIndex = state.items.findIndex(
            (i) => i.variantId === incoming.variantId
          );

          if (existingIndex >= 0) {
            const nextItems = [...state.items];
            const current = nextItems[existingIndex];
            const max = incoming.maxStock ?? current.maxStock;
            const updatedQty = current.quantity + qtyToAdd;
            nextItems[existingIndex] = {
              ...current,
              ...incoming,
              quantity: max ? Math.min(updatedQty, max) : updatedQty,
            };
            return { items: nextItems, isDrawerOpen: true };
          }

          const max = incoming.maxStock;
          const initialQty = max ? Math.min(qtyToAdd, max) : qtyToAdd;
          return {
            items: [...state.items, { ...incoming, quantity: initialQty }],
            isDrawerOpen: true,
          };
        }),

      updateQuantity: (variantId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((i) => i.variantId !== variantId),
            };
          }
          return {
            items: state.items.map((item) => {
              if (item.variantId !== variantId) return item;
              const capped = item.maxStock
                ? Math.min(quantity, item.maxStock)
                : quantity;
              return { ...item, quantity: Math.max(1, capped) };
            }),
          };
        }),

      removeItem: (variantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        })),

      clearCart: () => set({ items: [] }),

      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      toggleDrawer: () =>
        set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
    }),
    {
      name: "11sport-shop-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
