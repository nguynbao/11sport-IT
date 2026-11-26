import { useState, useCallback } from "react";
import type { Product, ProductVariant } from "@/shared/types";
import type { BarcodeLabelItem } from "@/shared/ui/BarcodeLabelModal";
import { getFloor1Stock } from "../utils/stock";
import type { InventoryWarehouse } from "../types";

interface Params {
  priceEdits: Record<string, number>;
  effectiveWarehouse: InventoryWarehouse;
  variantCodeFor: (baseCode?: string, color?: string, size?: string) => string;
}

export function useInventoryLabels({ priceEdits, effectiveWarehouse, variantCodeFor }: Params) {
  const [labelModalItems, setLabelModalItems] = useState<BarcodeLabelItem[] | null>(null);

  const expandProductToPrintLabelItems = useCallback(
    (p: Product, specificVariant?: ProductVariant): BarcodeLabelItem[] => {
      const f1 = getFloor1Stock(p);
      const effSellPrice = Number(priceEdits[p._id] ?? p.sellingPrice ?? 0);
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const namedVariants = variants.filter((v) => v.color || v.size);

      if (specificVariant) {
        const childCode = variantCodeFor(p.code, specificVariant.color, specificVariant.size);
        const vQty =
          effectiveWarehouse === "FLOOR_1"
            ? specificVariant.stockFloor1
            : effectiveWarehouse === "FLOOR_2"
              ? specificVariant.stockFloor2
              : specificVariant.stock;
        return [
          {
            id: `${p._id}_${childCode}`,
            code: childCode,
            productCode: p.code,
            productName: p.name,
            color: specificVariant.color,
            size: specificVariant.size,
            sellingPrice:
              Number(specificVariant.sellingPrice || 0) > 0
                ? Number(specificVariant.sellingPrice)
                : effSellPrice,
            unit: p.unit,
            defaultQty: Math.max(1, Number(vQty) || 1),
          },
        ];
      }

      if (namedVariants.length > 0) {
        return namedVariants.map((v, idx) => {
          const childCode = variantCodeFor(p.code, v.color, v.size);
          const vQty =
            effectiveWarehouse === "FLOOR_1"
              ? v.stockFloor1
              : effectiveWarehouse === "FLOOR_2"
                ? v.stockFloor2
                : v.stock;
          return {
            id: `${p._id}_${childCode}_${idx}`,
            code: childCode,
            productCode: p.code,
            productName: p.name,
            color: v.color,
            size: v.size,
            sellingPrice:
              Number(v.sellingPrice || 0) > 0 ? Number(v.sellingPrice) : effSellPrice,
            unit: p.unit,
            defaultQty: Math.max(1, Number(vQty) || 1),
          };
        });
      }

      return [
        {
          id: p._id,
          code: p.code,
          productCode: p.code,
          productName: p.name,
          sellingPrice: effSellPrice,
          unit: p.unit,
          defaultQty: Math.max(1, f1 || p.stock || 1),
        },
      ];
    },
    [effectiveWarehouse, priceEdits]
  );

  return { labelModalItems, setLabelModalItems, expandProductToPrintLabelItems };
}
