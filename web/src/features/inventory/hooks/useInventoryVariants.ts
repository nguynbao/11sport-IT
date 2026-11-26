import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Product } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { describeApiError } from "@/shared/api/errors";
import { addProductVariantsApi } from "@/shared/api/catalogLookup";
import { resolveVariantColorHexes } from "@/shared/ui/ColorSwatchPicker";

interface Params {
  isAdmin: boolean;
  loadInventory: () => Promise<void>;
  setPriceStatusMsg: Dispatch<SetStateAction<string | null>>;
}

export function useInventoryVariants({ isAdmin, loadInventory, setPriceStatusMsg }: Params) {
  const [expandedProdIds, setExpandedProdIds] = useState<Set<string>>(new Set());
  const [newVariantDrafts, setNewVariantDrafts] = useState<
    Record<
      string,
      {
        color: string;
        colorHexes?: string[];
        size: string;
        quantity: number;
        floor: "FLOOR_1" | "FLOOR_2";
      }
    >
  >({});
  const [addingVariantProdId, setAddingVariantProdId] = useState<string | null>(null);

  const toggleExpandProduct = (prodId: string) => {
    setExpandedProdIds((prev) => {
      const next = new Set(prev);
      if (next.has(prodId)) next.delete(prodId);
      else next.add(prodId);
      return next;
    });
  };

  const handleAddVariantToProduct = async (product: Product) => {
    const draft = newVariantDrafts[product._id] || {
      color: "",
      colorHexes: [],
      size: "",
      quantity: 0,
      floor: "FLOOR_1" as const,
    };
    const cleanColor = draft.color.trim();
    const cleanSize = draft.size.trim().toUpperCase();
    const qty = Math.max(0, Math.round(Number(draft.quantity) || 0));

    if (!cleanColor && !cleanSize) {
      alert("Vui lòng nhập Màu sắc hoặc Size để thêm phân loại!");
      return;
    }

    setAddingVariantProdId(product._id);
    try {
      if (product.versionCode) {
        const updated = await addProductVariantsApi(product._id, [
          {
            color: cleanColor,
            size: cleanSize,
            colorHexes: resolveVariantColorHexes(cleanColor, draft.colorHexes),
          },
        ]);
        if (isAdmin && qty > 0) {
          const nextVariants = (updated.variants || []).map((v) => {
            const isNew =
              String(v.color || "").trim().toLowerCase() === cleanColor.toLowerCase() &&
              String(v.size || "").trim().toUpperCase() === cleanSize;
            const f1 = Number(v.stockFloor1 || 0) + (isNew && draft.floor === "FLOOR_1" ? qty : 0);
            const f2 = Number(v.stockFloor2 || 0) + (isNew && draft.floor === "FLOOR_2" ? qty : 0);
            return {
              color: v.color,
              colorHexes: v.colorHexes,
              size: v.size,
              stockFloor1: f1,
              stockFloor2: f2,
            };
          });
          await apiRequest(`/products/${product._id}`, {
            method: "PATCH",
            body: JSON.stringify({ variants: nextVariants, allowDirectStock: true }),
          });
        }
        setNewVariantDrafts((prev) => ({
          ...prev,
          [product._id]: { color: "", colorHexes: [], size: "", quantity: 0, floor: "FLOOR_1" },
        }));
        await loadInventory();
        setPriceStatusMsg(
          `Đã thêm phân loại (${[cleanColor, cleanSize ? `Size ${cleanSize}` : ""].filter(Boolean).join(" - ")}) vào mã ${product.code}.`
        );
        return;
      }
      const catId =
        typeof product.categoryId === "object" ? product.categoryId?._id : product.categoryId;
      await apiRequest(`/products`, {
        method: "POST",
        body: JSON.stringify({
          code: product.code,
          name: product.name,
          brand: product.brand || "",
          categoryId: catId,
          unit: product.unit,
          color: cleanColor,
          colorHexes: resolveVariantColorHexes(cleanColor, draft.colorHexes),
          size: cleanSize,
          quantity: isAdmin ? qty : 0,
          targetWarehouse: draft.floor,
          upsertIfExists: true,
        }),
      });
      setNewVariantDrafts((prev) => ({
        ...prev,
        [product._id]: { color: "", colorHexes: [], size: "", quantity: 0, floor: "FLOOR_1" },
      }));
      await loadInventory();
      setPriceStatusMsg(
        `Đã thêm phân loại (${[cleanColor, cleanSize ? `Size ${cleanSize}` : ""].filter(Boolean).join(" - ")}) vào mã ${product.code}.`
      );
    } catch (err: any) {
      alert(describeApiError(err, "Không thể thêm phân loại Màu/Size"));
    } finally {
      setAddingVariantProdId(null);
    }
  };

  return {
    expandedProdIds,
    setExpandedProdIds,
    newVariantDrafts,
    setNewVariantDrafts,
    addingVariantProdId,
    toggleExpandProduct,
    handleAddVariantToProduct,
  };
}
