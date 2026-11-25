import { filterAndRankBySearch } from "@/shared/lib/search";
import { Product } from "@/shared/types";
import { ProductCodeCreatorResult } from "@/shared/ui/ProductCodeCreatorModal";
import { extractVariantFromText,findVariantByColorSize,resolveVariantCode,variantEffectiveCostPrice,variantEffectiveSellingPrice } from "@/shared/utils/productCode";
import React,{ useCallback } from "react";
import {
AdminImportRow
} from "../types";
import { parseAndApplyAdminImportFile } from "./adminImportFileParser";
import { submitAdminBatchImport } from "./adminImportSubmitHelper";

import { downloadAdminSampleCsv } from "./adminImportSampleCsv";
import type { InventoryState } from "./useInventoryState";

export interface InventoryAdminImportDeps {
  state: InventoryState;
  catalogByCode: Map<string, Product>;
  variantCodeFor: (baseCode?: string, color?: string, size?: string) => string;
  loadProductsAndCats: () => Promise<void>;
  loadCategoriesAndImports: () => Promise<void>;
  loadImports: () => Promise<void>;
  loadMovements: () => Promise<void>;
}

export function useInventoryAdminImport(deps: InventoryAdminImportDeps) {
  const {
    state,
    catalogByCode,
    variantCodeFor,
    loadProductsAndCats,
    loadCategoriesAndImports,
    loadImports,
    loadMovements,
  } = deps;
  const {
    subTab,
    products,
    categories,
    categoryId,
    brandOptions,
    showAdminImportModal,
    setShowAdminImportModal,
    adminImportNote,
    setAdminImportNote,
    newProdCatId,
    newProdWarehouse,
    adminImportRows,
    setAdminImportRows,
    setActiveAdminSuggestRowIdx,
    importFilterCatId,
    importFilterBrandId,
    setImportingAdminFile,
    submittingAdminImport,
    setSubmittingAdminImport,
    submittingImportRef,
    adminFileImportMode,
    allCatalogProducts,
    setAllCatalogProducts,
    setEditingProductModal,
    setStatusMsg,
  } = state;

  const getAdminRowSuggestions = useCallback(
    (query: string): Product[] => {
      const sourceList = (allCatalogProducts.length > 0 ? allCatalogProducts : products).filter((p) => {
        const catId = typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
        if (importFilterCatId && catId !== importFilterCatId) return false;
        if (importFilterBrandId) {
          if (p.brandId) {
            if (String(p.brandId) !== importFilterBrandId) return false;
          } else {
            const b = brandOptions.find((x) => x._id === importFilterBrandId);
            if (!b) return false;
            const norm = (t?: string) =>
              String(t || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
            const keys = new Set([norm(b.name), norm(b.code), ...(b.aliases || []).map(norm)]);
            if (!keys.has(norm(p.brand))) return false;
          }
        }
        return true;
      });
      const q = (query || "").trim();
      if (!q) return sourceList.slice(0, 12);
      return filterAndRankBySearch(sourceList, q, (p) => [
        { text: p.code, weight: 1.6 },
        { text: p.legacyCode, weight: 1.3 },
        { text: p.name, weight: 1.4 },
        { text: p.versionName, weight: 1.3 },
        { text: p.brandName || p.brand, weight: 1.1 },
        { text: p.categoryName, weight: 0.9 },
        ...(Array.isArray(p.variants)
          ? p.variants.map((v) => ({
            text: `${v.variantCode || ""} ${v.color || ""} ${v.size || ""}`,
            weight: 1.4,
          }))
          : []),
      ]).slice(0, 12);
    },
    [allCatalogProducts, products, importFilterCatId, importFilterBrandId, brandOptions]
  );

  const handleSelectAdminRowSuggestion = (rowIdx: number, prod: Product) => {
    setAdminImportRows((prev) => {
      const next = [...prev];
      const cur = next[rowIdx];
      if (!cur) return prev;
      const catId =
        typeof prod.categoryId === "object"
          ? prod.categoryId?._id || newProdCatId
          : String(prod.categoryId || newProdCatId);
      const vars = (prod.variants || []).filter((v) => v.color || v.size);
      const firstVar = vars[0];
      const vColor = firstVar ? firstVar.color || "" : prod.color || "";
      const vSize = firstVar ? firstVar.size || "" : prod.size || "";
      const vHexes = firstVar?.colorHexes || prod.colorHexes;
      const vCode = firstVar ? resolveVariantCode(prod, prod.code, vColor, vSize) : prod.code;
      next[rowIdx] = {
        ...cur,
        productId: prod._id,
        productName: prod.name,
        productCode: prod.code || "",
        variantCode: vCode,
        isNewVariant: vars.length === 0,
        brand: prod.brandName || prod.brand || cur.brand || "",
        categoryId: catId,
        color: vColor,
        colorHexes: vHexes,
        size: vSize,
        unit: prod.unit || cur.unit || "Cái",
        costPrice: variantEffectiveCostPrice(prod, firstVar),
        sellingPrice: variantEffectiveSellingPrice(prod, firstVar),
      };
      return next;
    });
    setActiveAdminSuggestRowIdx(null);
  };

  const handleSelectAdminRowVariant = (rowIdx: number, prod: Product, selectedVal: string) => {
    setAdminImportRows((prev) => {
      const next = [...prev];
      const cur = next[rowIdx];
      if (!cur) return prev;
      if (selectedVal === "__NEW__") {
        next[rowIdx] = {
          ...cur,
          isNewVariant: true,
          variantCode: undefined,
          color: "",
          colorHexes: [],
          size: "",
          costPrice: Number(prod.costPrice || 0),
          sellingPrice: Number(prod.sellingPrice || 0),
        };
        return next;
      }
      const [cRaw, sRaw] = selectedVal.split("||");
      const matched = findVariantByColorSize(prod, cRaw, sRaw);
      const vColor = matched?.color ?? cRaw ?? "";
      const vSize = matched?.size ?? sRaw ?? "";
      next[rowIdx] = {
        ...cur,
        isNewVariant: false,
        color: vColor,
        colorHexes: matched?.colorHexes,
        size: vSize,
        variantCode: resolveVariantCode(prod, prod.code, vColor, vSize),
        costPrice: variantEffectiveCostPrice(prod, matched),
        sellingPrice: variantEffectiveSellingPrice(prod, matched),
      };
      return next;
    });
  };

  const handleClearAdminRowProduct = (rowIdx: number) => {
    setAdminImportRows((prev) => {
      const next = [...prev];
      const cur = next[rowIdx];
      if (!cur) return prev;
      next[rowIdx] = {
        ...cur,
        productId: undefined,
        productCode: "",
        variantCode: undefined,
        isNewVariant: false,
        productName: "",
        color: "",
        colorHexes: [],
        size: "",
        costPrice: 0,
        sellingPrice: 0,
      };
      return next;
    });
    setActiveAdminSuggestRowIdx(rowIdx);
  };

  const handleUpdateAdminRow = (index: number, field: keyof AdminImportRow, value: any) => {
    setAdminImportRows((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      const cat = categories.find((c) => c._id === String(item.categoryId || newProdCatId));

      // v5.0: KHÔNG tự sinh mã ở client. Dòng gắn sản phẩm có sẵn (productId) giữ mã server;
      // đổi tên/danh mục/hãng => tách khỏi sản phẩm cũ, server sẽ sinh mã mới (Cate + Brand + Version).
      if (field === "productName") {
        const linked = item.productId
          ? (allCatalogProducts.length > 0 ? allCatalogProducts : products).find((p) => p._id === item.productId)
          : undefined;
        if (!linked || linked.name !== String(value)) {
          item.productId = undefined;
          item.productCode = "";
        }
        const extracted = extractVariantFromText(String(value), {
          categoryCode: cat?.code,
          categoryName: cat?.name,
          brand: item.brand,
        });
        if (!item.brand && extracted.brand) item.brand = extracted.brand;
        if (!item.color && extracted.color) item.color = extracted.color;
        if (!item.size && extracted.size) item.size = extracted.size;
      }

      if (field === "categoryId") {
        item.categoryId = String(value || "");
        item.productId = undefined;
        item.productCode = "";
      }

      if (field === "brand") {
        item.brand = String(value || "");
        item.productId = undefined;
        item.productCode = "";
      }

      if (field === "productCode") {
        item.productId = undefined;
        item.productCode = String(value || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
      }

      if (field === "colorCode") {
        item.colorCode = String(value || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 3);
      }

      if (field === "size") {
        item.size = String(value || "").toUpperCase();
      }

      if (field === "quantity") {
        item.quantity = Math.max(0, Math.round(Number(value) || 0));
      }

      next[index] = item;

      // Đồng bộ Giá gốc & Giá bán cho các dòng cùng Mã SP chung
      if ((field === "costPrice" || field === "sellingPrice") && item.productCode) {
        for (let i = 0; i < next.length; i++) {
          if (i !== index && next[i].productCode === item.productCode) {
            next[i] = { ...next[i], [field]: value };
          }
        }
      }

      return next;
    });
  };

  const handleAddAdminRow = () => {
    const initCatId = newProdCatId || categories[0]?._id || "";
    setAdminImportRows((prev) => [
      ...prev,
      {
        stt: prev.length + 1,
        productCode: "",
        productName: "",
        categoryId: prev[prev.length - 1]?.categoryId || initCatId,
        brand: "",
        color: "",
        size: "",
        unit: "Cái",
        quantity: 1,
        costPrice: 0,
        sellingPrice: 0,
        note: "",
        isConfirmed: false,
      },
    ]);
  };

  const handleDuplicateAdminRow = (index: number) => {
    setAdminImportRows((prev) => {
      const source = prev[index];
      if (!source) return prev;
      const cloned: AdminImportRow = {
        ...source,
        colorHexes: Array.isArray(source.colorHexes) ? [...source.colorHexes] : [],
        size: "",
        isConfirmed: false,
      };
      const next = [...prev.slice(0, index + 1), cloned, ...prev.slice(index + 1)];
      return next.map((r, idx) => ({ ...r, stt: idx + 1 }));
    });
  };

  const handleUpdateAdminRowColor = (
    index: number,
    nextColor: string,
    nextHexes: string[]
  ) => {
    setAdminImportRows((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      const updated = { ...cur, color: nextColor, colorHexes: nextHexes };
      next[index] = updated;
      const cleanColorKey = String(nextColor || "").trim().toLowerCase();
      if (updated.productCode && cleanColorKey && nextHexes.length > 0) {
        for (let i = 0; i < next.length; i++) {
          if (
            i !== index &&
            next[i].productCode === updated.productCode &&
            String(next[i].color || "").trim().toLowerCase() === cleanColorKey
          ) {
            next[i] = { ...next[i], colorHexes: nextHexes };
          }
        }
      }
      return next;
    });
  };

  // v5.0: sau khi tạo SP chuẩn mã / thêm biến thể => nạp lại danh mục và (nếu đang mở phiếu nhập) thêm dòng theo từng biến thể
  const handleCodeCreatorDone = async (result: ProductCodeCreatorResult) => {
    const { product, variants, mode } = result;
    setEditingProductModal(null);
    setStatusMsg({
      type: "success",
      text:
        mode === "CREATED"
          ? `Đã tạo sản phẩm "${product.name}" mã ${product.code}.`
          : mode === "UPDATED"
            ? `Đã cập nhật sản phẩm "${product.name}" mã ${product.code}.`
            : `Đã thêm ${variants.length} biến thể vào sản phẩm ${product.code}.`,
    });
    setAllCatalogProducts((prev) => [product, ...prev.filter((p) => p._id !== product._id)]);
    loadProductsAndCats();
    if (!showAdminImportModal || mode === "UPDATED") return;
    const catId =
      typeof product.categoryId === "object" ? product.categoryId?._id || "" : String(product.categoryId || "");
    const lines = variants.length > 0 ? variants : [{ color: "", size: "" }];
    setAdminImportRows((prev) => {
      const base = prev.filter((r) => r.productName.trim() !== "" || r.productCode.trim() !== "");
      const added: AdminImportRow[] = lines.map((v) => {
        const pv = findVariantByColorSize(product, v.color, v.size);
        return {
          stt: 0,
          productId: product._id,
          productCode: product.code,
          variantCode: resolveVariantCode(product, product.code, v.color, v.size),
          isNewVariant: false,
          productName: product.name,
          categoryId: catId,
          brand: product.brandName || product.brand || "",
          color: v.color || "",
          colorHexes: pv?.colorHexes,
          size: v.size || "",
          unit: product.unit || "Cái",
          quantity: 1,
          costPrice: variantEffectiveCostPrice(product, pv),
          sellingPrice: variantEffectiveSellingPrice(product, pv),
          note: "",
          isConfirmed: false,
        };
      });
      return [...base, ...added].map((r, idx) => ({ ...r, stt: idx + 1 }));
    });
  };

  const handleRemoveAdminRow = (index: number) => {
    setAdminImportRows((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      if (filtered.length === 0) {
        return [
          {
            stt: 1,
            productCode: "",
            productName: "",
            categoryId: newProdCatId || categories[0]?._id || "",
            brand: "",
            color: "",
            size: "",
            unit: "Cái",
            quantity: 1,
            costPrice: 0,
            sellingPrice: 0,
            note: "",
            isConfirmed: false,
          },
        ];
      }
      return filtered.map((r, idx) => ({ ...r, stt: idx + 1 }));
    });
  };

  const handleDownloadAdminSampleCsv = downloadAdminSampleCsv;

  const handleAdminImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    parseAndApplyAdminImportFile(e, state);

  const handleSubmitAdminBatchImport = (e: React.FormEvent) =>
    submitAdminBatchImport(e, {
      state,
      catalogByCode,
      variantCodeFor,
      loadProductsAndCats,
      loadCategoriesAndImports,
      loadImports,
      loadMovements,
    });

  // Lưu danh sách phân loại (Size • Màu sắc • Tồn Tầng 1/2) của 1 sản phẩm

  return {
    getAdminRowSuggestions,
    handleSelectAdminRowSuggestion,
    handleSelectAdminRowVariant,
    handleClearAdminRowProduct,
    handleUpdateAdminRow,
    handleAddAdminRow,
    handleDuplicateAdminRow,
    handleUpdateAdminRowColor,
    handleCodeCreatorDone,
    handleRemoveAdminRow,
    handleDownloadAdminSampleCsv,
    handleAdminImportFileChange,
    handleSubmitAdminBatchImport,
  };
}
