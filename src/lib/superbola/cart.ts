import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartRequestItem } from "./pricing";

export type CartLine = {
  key: string;
  title: string;
  subtitle: string;
  unitCents: number;
  request: CartRequestItem;
};

type CartState = {
  lines: CartLine[];
  mode: "delivery" | "pickup";
  setMode: (mode: "delivery" | "pickup") => void;
  add: (line: Omit<CartLine, "key"> & { key?: string }) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      mode: "delivery",
      setMode: (mode) => set({ mode }),
      add: (line) => set({ lines: [...get().lines, { ...line, key: line.key ?? crypto.randomUUID() }] }),
      setQty: (key, qty) =>
        set({
          lines:
            qty <= 0
              ? get().lines.filter((line) => line.key !== key)
              : get().lines.map((line) =>
                  line.key === key ? { ...line, request: { ...line.request, qty } } : line,
                ),
        }),
      remove: (key) => set({ lines: get().lines.filter((line) => line.key !== key) }),
      clear: () => set({ lines: [] }),
    }),
    { name: "superbola-cart-v1", skipHydration: true },
  ),
);

export function cartCount(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.request.qty, 0);
}

export function cartSubtotal(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.unitCents * line.request.qty, 0);
}
