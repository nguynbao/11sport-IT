import { apiRequest } from "@/shared/api/client";
import { describeApiError } from "@/shared/api/errors";
import { Product,ProductVariant } from "@/shared/types";
import { BarcodeLabelItem } from "@/shared/ui/BarcodeLabelModal";
import {
resolveVariantColorHexes
} from "@/shared/ui/ColorSwatchPicker";


import type { InventoryState } from "./useInventoryState";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export interface InventoryVariantActionsDeps {
  state: InventoryState;
  variantCodeFor: (baseCode?: string, color?: string, size?: string) => string;
  loadProductsAndCats: () => Promise<void>;
  getDisplayedProducts: () => Product[];
  getActiveQty: (p: Product) => number;
}

export function useInventoryVariantActions(deps: InventoryVariantActionsDeps) {
  const { state, variantCodeFor, loadProductsAndCats, getDisplayedProducts, getActiveQty } = deps;
  const {
    activeWarehouse,
    products,
    editingPrices,
    editingVariants,
    setEditingVariants,
    newVariantInputs,
    setNewVariantInputs,
    setSavingVariantsProdId,
    setLabelItems,
    setShowLabelModal,
    setStatusMsg,
  } = state;

  const handleSaveProductVariants = async (prod: Product, nextVars?: ProductVariant[]) => {
    const varsToSave = nextVars ?? editingVariants[prod._id] ?? [];
    setSavingVariantsProdId(prod._id);
    setStatusMsg(null);
    try {
      await apiRequest(API_ENDPOINTS.PRODUCTS.byId(prod._id), {
        method: "PATCH",
        body: JSON.stringify({
          variants: varsToSave.map((v) => ({
            color: String(v.color || "").trim(),
            colorHexes: resolveVariantColorHexes(v.color, v.colorHexes),
            size: String(v.size || "").trim().toUpperCase(),
            stockFloor1: Math.max(0, Math.round(Number(v.stockFloor1 || 0))),
            stockFloor2: Math.max(0, Math.round(Number(v.stockFloor2 || 0))),
          })),
          allowDirectStock: true,
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã cập nhật phân loại Màu sắc / Size & Số lượng tồn kho cho mã "${prod.code}"!`,
      });
      await loadProductsAndCats();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể lưu phân loại Size/Màu.",
      });
    } finally {
      setSavingVariantsProdId(null);
    }
  };

  // v5.0 (R8): sửa giá bán/giá vốn riêng của biến thể qua PATCH /products/:id { variantPrices }
  const handleSaveVariantPrice = async (
    prod: Product,
    v: ProductVariant,
    field: "sellingPrice" | "costPrice",
    value: number
  ) => {
    const next = Math.max(0, Math.round(Number(value) || 0));
    if (next === Math.max(0, Number(v[field] || 0))) return;
    if (!v.variantKey && !v.variantCode) return;
    try {
      await apiRequest(API_ENDPOINTS.PRODUCTS.byId(prod._id), {
        method: "PATCH",
        body: JSON.stringify({
          variantPrices: [
            {
              ...(v.variantKey ? { variantKey: v.variantKey } : { variantCode: v.variantCode }),
              [field]: next,
            },
          ],
        }),
      });
      setEditingVariants((prev) => ({
        ...prev,
        [prod._id]: (prev[prod._id] || prod.variants || []).map((it) =>
          (v.variantKey && it.variantKey === v.variantKey) || (!v.variantKey && it.variantCode === v.variantCode)
            ? { ...it, [field]: next }
            : it
        ),
      }));
      setStatusMsg({
        type: "success",
        text: `Đã cập nhật ${field === "sellingPrice" ? "giá niêm yết" : "giá vốn"} riêng cho ${v.variantCode || `${v.color} ${v.size}`}${next === 0 ? " (dùng giá mặc định)" : ""}.`,
      });
      loadProductsAndCats();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: describeApiError(err, "Không lưu được giá biến thể.") });
    }
  };

  const handleAddVariantToProduct = async (prod: Product) => {
    const draft = newVariantInputs[prod._id] || {
      color: "",
      colorHexes: [],
      size: "",
      stockFloor1: activeWarehouse === "FLOOR_2" ? 0 : 1,
      stockFloor2: activeWarehouse === "FLOOR_2" ? 1 : 0,
    };
    const color = draft.color.trim();
    const colorHexes = resolveVariantColorHexes(color, draft.colorHexes);
    const size = draft.size.trim().toUpperCase();
    if (!color) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng nhập Màu sắc (bắt buộc) để thêm phân loại mới vào kho.",
      });
      return;
    }
    const f1 = Math.max(0, Math.round(Number(draft.stockFloor1 || 0)));
    const f2 = Math.max(0, Math.round(Number(draft.stockFloor2 || 0)));
    const current = [...(editingVariants[prod._id] || [])];
    const existingIdx = current.findIndex(
      (v) =>
        String(v.color || "").trim().toLowerCase() === color.toLowerCase() &&
        String(v.size || "").trim().toUpperCase() === size
    );
    if (existingIdx >= 0) {
      current[existingIdx] = {
        ...current[existingIdx],
        colorHexes:
          colorHexes.length > 0 ? colorHexes : current[existingIdx].colorHexes,
        stockFloor1: (Number(current[existingIdx].stockFloor1) || 0) + f1,
        stockFloor2: (Number(current[existingIdx].stockFloor2) || 0) + f2,
        stock:
          (Number(current[existingIdx].stockFloor1) || 0) +
          f1 +
          (Number(current[existingIdx].stockFloor2) || 0) +
          f2,
      };
    } else {
      current.push({
        color,
        colorHexes,
        size,
        stockFloor1: f1,
        stockFloor2: f2,
        stock: f1 + f2,
      });
    }
    setEditingVariants((prev) => ({ ...prev, [prod._id]: current }));
    setNewVariantInputs((prev) => ({
      ...prev,
      [prod._id]: { color: "", colorHexes: [], size: "", stockFloor1: 1, stockFloor2: 0 },
    }));
    await handleSaveProductVariants(prod, current);
  };

  // Mở modal in tem mã vạch theo Mã con của từng thuộc tính (Màu sắc + Size), không in mã gốc khi có biến thể
  const buildLabelItemsForProduct = (
    prod: Product,
    specificVariant?: ProductVariant
  ): BarcodeLabelItem[] => {
    const sellPrice = Number(editingPrices[prod._id] ?? prod.sellingPrice ?? 0);
    const prodVariants = editingVariants[prod._id] ?? prod.variants ?? [];
    const namedVars = prodVariants.filter((v) => v.color || v.size);
    // R8: giá biến thể riêng (> 0) ưu tiên, trống => giá gốc
    const variantSellPrice = (v: ProductVariant) =>
      Number(v.sellingPrice || 0) > 0 ? Number(v.sellingPrice) : sellPrice;

    if (specificVariant) {
      const childCode = variantCodeFor(
        prod.code,
        specificVariant.color,
        specificVariant.size
      );
      const vQty =
        activeWarehouse === "FLOOR_2"
          ? Number(specificVariant.stockFloor2 || 0)
          : activeWarehouse === "FLOOR_1"
            ? Number(specificVariant.stockFloor1 || 0)
            : (Number(specificVariant.stockFloor1) || 0) +
            (Number(specificVariant.stockFloor2) || 0);
      return [
        {
          id: `${prod._id}_${childCode}`,
          code: childCode,
          productCode: prod.code,
          productName: prod.name,
          color: specificVariant.color,
          size: specificVariant.size,
          sellingPrice: variantSellPrice(specificVariant),
          unit: prod.unit,
          defaultQty: Math.max(1, vQty || 1),
        },
      ];
    }

    if (namedVars.length > 0) {
      return namedVars.map((v, idx) => {
        const childCode = variantCodeFor(prod.code, v.color, v.size);
        const vQty =
          activeWarehouse === "FLOOR_2"
            ? Number(v.stockFloor2 || 0)
            : activeWarehouse === "FLOOR_1"
              ? Number(v.stockFloor1 || 0)
              : (Number(v.stockFloor1) || 0) + (Number(v.stockFloor2) || 0);

        return {
          id: `${prod._id}_${childCode}_${idx}`,
          code: childCode,
          productCode: prod.code,
          productName: prod.name,
          color: v.color,
          size: v.size,
          sellingPrice: variantSellPrice(v),
          unit: prod.unit,
          defaultQty: Math.max(1, vQty || 1),
        };
      });
    }

    const qty = Math.max(1, getActiveQty(prod) || 1);
    return [
      {
        id: prod._id,
        code: prod.code,
        productCode: prod.code,
        productName: prod.name,
        sellingPrice: sellPrice,
        unit: prod.unit,
        defaultQty: qty,
      },
    ];
  };

  const handleOpenPrintLabelForProduct = (
    prod: Product,
    specificVariant?: ProductVariant
  ) => {
    setLabelItems(buildLabelItemsForProduct(prod, specificVariant));
    setShowLabelModal(true);
  };

  const handleOpenPrintLabelsForDisplayed = () => {
    const list: BarcodeLabelItem[] = getDisplayedProducts()
      .slice(0, 50)
      .flatMap((prod) => buildLabelItemsForProduct(prod));
    setLabelItems(list);
    setShowLabelModal(true);
  };

  return {
    handleSaveProductVariants,
    handleSaveVariantPrice,
    handleAddVariantToProduct,
    buildLabelItemsForProduct,
    handleOpenPrintLabelForProduct,
    handleOpenPrintLabelsForDisplayed,
  };
}
