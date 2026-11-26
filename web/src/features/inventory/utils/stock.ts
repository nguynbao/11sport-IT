import type { Product } from "@/shared/types";

export const getFloor1Stock = (p: Product): number => {
  const f1 = Number(p.stockFloor1);
  const f2 = Number(p.stockFloor2 || 0);
  const legacyStock = Number(p.stock || 0);
  if (p.stockFloor1 === undefined || p.stockFloor1 === null || Number.isNaN(f1)) {
    return Math.max(0, legacyStock - f2);
  }
  if (f1 === 0 && f2 === 0 && legacyStock > 0) {
    return legacyStock;
  }
  return f1;
};
