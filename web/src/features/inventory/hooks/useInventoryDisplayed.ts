import { useMemo } from "react";
import type { Brand, Product } from "@/shared/types";
import { filterAndRankBySearch } from "@/shared/lib/search";
import { getFloor1Stock } from "../utils/stock";
import type { InventoryWarehouse } from "../types";

interface Params {
  products: Product[];
  isSales: boolean;
  effectiveWarehouse: InventoryWarehouse;
  floor1Codes: Set<string>;
  floor2Codes: Set<string>;
  search: string;
  onlyShowScanned: boolean;
  scannedCheckCounts: Record<string, number>;
  brandFilter: string;
  brandOptions: Brand[];
  variantCodeFor: (baseCode?: string, color?: string, size?: string) => string;
}

export function useInventoryDisplayed({
  products,
  isSales,
  effectiveWarehouse,
  floor1Codes,
  floor2Codes,
  search,
  onlyShowScanned,
  scannedCheckCounts,
  brandFilter,
  brandOptions,
  variantCodeFor,
}: Params) {
  const displayedProducts = useMemo(() => {
    const byFloor = products
      .filter((p) => {
        if (onlyShowScanned && !scannedCheckCounts[p._id]) {
          return false;
        }
        const f1 = getFloor1Stock(p);
        const f2 = Number(p.stockFloor2) || 0;
        if (isSales) {
          return f1 > 0 || Boolean(scannedCheckCounts[p._id]);
        }
        if (effectiveWarehouse === "FLOOR_1") {
          return (
            f1 > 0 ||
            floor1Codes.has(p.code) ||
            !floor2Codes.has(p.code) ||
            Boolean(scannedCheckCounts[p._id])
          );
        }
        if (effectiveWarehouse === "FLOOR_2") {
          return f2 > 0 || floor2Codes.has(p.code) || Boolean(scannedCheckCounts[p._id]);
        }
        return true;
      })
      .filter((p) => {
        if (!brandFilter) return true;
        if (p.brandId) return String(p.brandId) === brandFilter;
        const b = brandOptions.find((x) => x._id === brandFilter);
        if (!b) return false;
        const norm = (t?: string) =>
          String(t || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
        const keys = new Set([norm(b.name), norm(b.code), ...(b.aliases || []).map(norm)]);
        return keys.has(norm(p.brand));
      });

    if (!search.trim()) return byFloor;
    return filterAndRankBySearch(byFloor, search, (p) => [
      { text: p.code, weight: 1.5 },
      { text: p.barcode, weight: 1.5 },
      { text: p.legacyCode, weight: 1.2 },
      { text: p.versionName, weight: 1.2 },
      { text: p.name, weight: 1.3 },
      { text: p.note, weight: 0.9 },
      { text: p.brandName || p.brand, weight: 1.1 },
      { text: p.categoryName, weight: 0.9 },
      { text: p.categoryCode, weight: 0.9 },
      { text: p.unit, weight: 0.6 },
      ...(Array.isArray(p.variants)
        ? p.variants.map((v) => ({
            text: `${v.variantCode || variantCodeFor(p.code, v.color, v.size)} ${v.color || ""} ${v.size || ""} size ${v.size || ""}`,
            weight: 1.4,
          }))
        : []),
    ]);
  }, [
    products,
    isSales,
    effectiveWarehouse,
    floor1Codes,
    floor2Codes,
    search,
    onlyShowScanned,
    scannedCheckCounts,
    brandFilter,
    brandOptions,
  ]);

  return displayedProducts;
}
