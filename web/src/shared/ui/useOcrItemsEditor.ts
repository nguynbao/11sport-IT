"use client";

import { useState, useCallback } from "react";
import type { ImportItem, Product } from "@/shared/types";
import { filterAndRankBySearch } from "@/shared/lib/search";
import { createEmptyOcrItem } from "./cameraScannerHelpers";

/** State + thao tác chỉnh sửa bảng dòng hàng OCR (gợi ý sản phẩm, thêm/sửa/xóa dòng). */
export function useOcrItemsEditor(catalogProducts: Product[]) {
  const [ocrItems, setOcrItems] = useState<ImportItem[]>([createEmptyOcrItem(1)]);
  const [activeOcrSuggestIdx, setActiveOcrSuggestIdx] = useState<number | null>(null);
  const [ocrSuggestHighlightIdx, setOcrSuggestHighlightIdx] = useState<number>(0);

  const getOcrRowSuggestions = useCallback(
    (query: string): Product[] => {
      const q = (query || "").trim();
      if (!q) return catalogProducts.slice(0, 8);
      return filterAndRankBySearch(catalogProducts, q, (p) => [
        p.name,
        p.code,
        p.categoryName,
      ]).slice(0, 8);
    },
    [catalogProducts]
  );

  const handleSelectOcrSuggestion = (rowIdx: number, prod: Product) => {
    setOcrItems((prev) => {
      const next = [...prev];
      const cur = next[rowIdx];
      if (!cur) return prev;
      next[rowIdx] = {
        ...cur,
        productName: prod.name,
        productCode: prod.code || "",
        unit: prod.unit || cur.unit || "Cái",
        costPrice: Number(cur.costPrice) > 0 ? Number(cur.costPrice) : Number(prod.costPrice || 0),
        sellingPrice:
          Number(cur.sellingPrice) > 0 ? Number(cur.sellingPrice) : Number(prod.sellingPrice || 0),
      };
      return next;
    });
    setActiveOcrSuggestIdx(null);
  };

  const handleUpdateOcrRow = (index: number, field: keyof ImportItem, value: any) => {
    setOcrItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === "productName") item.productCode = ""; // v5.0: không tự sinh mã ở client
      if (field === "expectedQuantity") item.actualQuantity = Number(value) || 0;
      next[index] = item;
      return next;
    });
  };

  const handleAddOcrRow = () => setOcrItems((prev) => [...prev, createEmptyOcrItem(prev.length + 1)]);

  const handleRemoveOcrRow = (index: number) => {
    setOcrItems((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      if (filtered.length === 0) return [createEmptyOcrItem(1)];
      return filtered.map((it, idx) => ({ ...it, stt: idx + 1 }));
    });
  };

  return {
    ocrItems,
    setOcrItems,
    activeOcrSuggestIdx,
    setActiveOcrSuggestIdx,
    ocrSuggestHighlightIdx,
    setOcrSuggestHighlightIdx,
    getOcrRowSuggestions,
    handleSelectOcrSuggestion,
    handleUpdateOcrRow,
    handleAddOcrRow,
    handleRemoveOcrRow,
  };
}
