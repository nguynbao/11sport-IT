import { useState, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Product } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";

interface Params {
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  setPriceStatusMsg: Dispatch<SetStateAction<string | null>>;
}

export function useInventoryPriceEdit({ products, setProducts, setPriceStatusMsg }: Params) {
  const [priceEdits, setPriceEdits] = useState<Record<string, number>>({});
  const [savingBatch, setSavingBatch] = useState(false);

  const changedPriceProducts = useMemo(() => {
    return products.filter(
      (p) => priceEdits[p._id] !== undefined && priceEdits[p._id] !== Number(p.sellingPrice || 0)
    );
  }, [products, priceEdits]);

  const handleSaveAllPriceChanges = async () => {
    if (changedPriceProducts.length === 0 || savingBatch) return;
    setSavingBatch(true);
    setPriceStatusMsg(null);
    try {
      const updatedMap: Record<string, number> = {};
      for (const p of changedPriceProducts) {
        const nextPrice = priceEdits[p._id];
        const res = await apiRequest<Product>(`/products/${p._id}`, {
          method: "PATCH",
          body: JSON.stringify({ sellingPrice: nextPrice }),
        });
        updatedMap[p._id] = res.data?.sellingPrice ?? nextPrice;
      }
      setProducts((prev) =>
        prev.map((item) =>
          updatedMap[item._id] !== undefined
            ? { ...item, sellingPrice: updatedMap[item._id] }
            : item
        )
      );
      setPriceEdits((prev) => {
        const copy = { ...prev };
        changedPriceProducts.forEach((p) => delete copy[p._id]);
        return copy;
      });
      setPriceStatusMsg(
        `Đã lưu thành công giá niêm yết của ${changedPriceProducts.length} mặt hàng.`
      );
    } catch (err: any) {
      alert(err?.message || "Không thể cập nhật giá niêm yết");
    } finally {
      setSavingBatch(false);
    }
  };

  return { priceEdits, setPriceEdits, savingBatch, changedPriceProducts, handleSaveAllPriceChanges };
}
