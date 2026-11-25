import { apiRequest } from "@/shared/api/client";
import { filterAndRankBySearch } from "@/shared/lib/search";
import { Product,WarehouseFloor } from "@/shared/types";
import React,{ useMemo } from "react";


import type { InventoryState } from "./useInventoryState";

export interface InventoryTransferDeps {
  state: InventoryState;
  variantCodeFor: (baseCode?: string, color?: string, size?: string) => string;
  loadProductsAndCats: () => Promise<void>;
  loadTransfers: () => Promise<void>;
  loadMovements: () => Promise<void>;
}

export function useInventoryTransfer(deps: InventoryTransferDeps) {
  const {
    state,
    variantCodeFor,
    loadProductsAndCats,
    loadTransfers,
    loadMovements,
  } = deps;
  const {
    products,
    importsList,
    transferDirection,
    setTransferDirection,
    transferProductId,
    setTransferProductId,
    transferColor,
    setTransferColor,
    transferSize,
    setTransferSize,
    transferQty,
    setTransferQty,
    setTransferSearch,
    setTransferSuggestOpen,
    transferItems,
    setTransferItems,
    transferNote,
    setTransferNote,
    setExpandedTransferCode,
    setStatusMsg,
    debouncedTransferSearch,
  } = state;

  const sourceFloorProducts = useMemo(() => {
    const avail = products.filter((p) => {
      const f1 = Number(p.stockFloor1 ?? p.stock) || 0;
      const f2 = Number(p.stockFloor2) || 0;
      const sourceStock = transferDirection === "F1_TO_F2" ? f1 : f2;
      return sourceStock > 0;
    });
    if (!debouncedTransferSearch.trim()) return avail;
    return filterAndRankBySearch(avail, debouncedTransferSearch, (p) => [
      { text: p.code, weight: 1.5 },
      { text: p.name, weight: 1.3 },
      { text: p.categoryName, weight: 0.9 },
      ...(Array.isArray(p.variants)
        ? p.variants.map((v) => ({
          text: `${v.variantCode || variantCodeFor(p.code, v.color, v.size)} ${v.color || ""} ${v.size || ""}`,
          weight: 1.4,
        }))
        : []),
    ]);
  }, [products, transferDirection, debouncedTransferSearch]);

  const getSourceFloorStock = (p?: Product): number => {
    if (!p) return 0;
    const f1 = Number(p.stockFloor1 ?? p.stock) || 0;
    const f2 = Number(p.stockFloor2) || 0;
    return transferDirection === "F1_TO_F2" ? f1 : f2;
  };

  const getVariantSourceFloorStock = (
    v?: { stockFloor1?: number; stockFloor2?: number; stock?: number },
    dir: "F1_TO_F2" | "F2_TO_F1" = transferDirection
  ): number => {
    if (!v) return 0;
    const f1 = Number(v.stockFloor1 ?? v.stock ?? 0);
    const f2 = Number(v.stockFloor2 ?? 0);
    return dir === "F1_TO_F2" ? f1 : f2;
  };

  const getProductSourceVariants = (
    p?: Product,
    dir: "F1_TO_F2" | "F2_TO_F1" = transferDirection
  ) => {
    const vars = Array.isArray(p?.variants) ? p!.variants! : [];
    const withStock = vars.filter((v) => getVariantSourceFloorStock(v, dir) > 0);
    return withStock.length > 0 ? withStock : vars;
  };

  const getSourceVariantFloorStock = (
    p?: Product,
    color?: string,
    size?: string
  ): number => {
    if (!p) return 0;
    const cNorm = String(color || "").trim().toLowerCase();
    const sNorm = String(size || "").trim().toUpperCase();
    const vars = Array.isArray(p.variants) ? p.variants : [];
    if (vars.length > 0 && (cNorm || sNorm)) {
      const exact = vars.find(
        (v) =>
          String(v.color || "").trim().toLowerCase() === cNorm &&
          String(v.size || "").trim().toUpperCase() === sNorm
      );
      if (exact) {
        return getVariantSourceFloorStock(exact);
      }
      if (cNorm && !sNorm) {
        const byColor = vars.filter(
          (v) => String(v.color || "").trim().toLowerCase() === cNorm
        );
        if (byColor.length > 0) {
          return byColor.reduce((sum, v) => sum + getVariantSourceFloorStock(v), 0);
        }
      }
    }
    return getSourceFloorStock(p);
  };

  const getTransferItemKey = (productId: string, color?: string, size?: string) =>
    `${productId}__${String(color || "").trim().toLowerCase()}__${String(size || "").trim().toUpperCase()}`;

  const syncDefaultTransferVariantForProduct = (
    prod?: Product,
    dir: "F1_TO_F2" | "F2_TO_F1" = transferDirection
  ) => {
    const availVars = getProductSourceVariants(prod, dir);
    if (availVars.length > 0) {
      setTransferColor(availVars[0].color || "");
      setTransferSize(availVars[0].size || "");
    } else {
      setTransferColor(prod?.color || "");
      setTransferSize(prod?.size || "");
    }
  };

  const handleSelectTransferProduct = (prodId: string) => {
    setTransferProductId(prodId);
    const prod = products.find((p) => p._id === prodId);
    syncDefaultTransferVariantForProduct(prod, transferDirection);
  };

  const handleChangeTransferDirection = (dir: "F1_TO_F2" | "F2_TO_F1") => {
    setTransferDirection(dir);
    setTransferItems([]);
    setTransferSearch("");
    setTransferProductId("");
    setTransferColor("");
    setTransferSize("");
    setTransferQty(1);
    setTransferSuggestOpen(false);
  };

  const handleAddTransferItem = (
    prodId?: string,
    qtyToAdd?: number,
    explicitColor?: string,
    explicitSize?: string
  ) => {
    setStatusMsg(null);
    const targetId = prodId || transferProductId;
    if (!targetId) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng chọn sản phẩm cần chuyển kho.",
      });
      return;
    }
    const prod = products.find((p) => p._id === targetId);
    if (!prod) return;

    const prodVars = getProductSourceVariants(prod);
    let chosenColor =
      explicitColor !== undefined
        ? explicitColor
        : targetId === (transferProductId || sourceFloorProducts[0]?._id)
          ? transferColor
          : "";
    let chosenSize =
      explicitSize !== undefined
        ? explicitSize
        : targetId === (transferProductId || sourceFloorProducts[0]?._id)
          ? transferSize
          : "";

    if (!chosenColor && !chosenSize && prodVars.length > 0) {
      chosenColor = prodVars[0].color || "";
      chosenSize = prodVars[0].size || "";
    }

    const cleanColor = String(chosenColor || "").trim();
    const cleanSize = String(chosenSize || "").trim().toUpperCase();
    const maxAvail = getSourceVariantFloorStock(prod, cleanColor, cleanSize);

    if (maxAvail <= 0) {
      const variantText = [cleanColor ? `Màu ${cleanColor}` : "", cleanSize ? `Size ${cleanSize}` : ""]
        .filter(Boolean)
        .join(" - ");
      setStatusMsg({
        type: "error",
        text: `Sản phẩm "${prod.name}"${variantText ? ` (${variantText})` : ""} không còn tồn ở kho đầu dời.`,
      });
      return;
    }
    const addQty = Math.max(1, Math.round(Number(qtyToAdd ?? transferQty) || 1));
    const targetKey = getTransferItemKey(targetId, cleanColor, cleanSize);

    setTransferItems((prev) => {
      const existing = prev.find(
        (i) => getTransferItemKey(i.productId, i.color, i.size) === targetKey
      );
      if (existing) {
        const nextQty = Math.min(maxAvail, existing.quantity + addQty);
        return prev.map((i) =>
          getTransferItemKey(i.productId, i.color, i.size) === targetKey
            ? { ...i, quantity: nextQty }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: targetId,
          color: cleanColor,
          size: cleanSize,
          quantity: Math.min(maxAvail, addQty),
        },
      ];
    });
    setTransferQty(1);
  };

  const handleUpdateTransferItemVariant = (
    itemKey: string,
    nextColor: string,
    nextSize: string
  ) => {
    const cleanColor = String(nextColor || "").trim();
    const cleanSize = String(nextSize || "").trim().toUpperCase();
    setTransferItems((prev) => {
      const target = prev.find(
        (i) => getTransferItemKey(i.productId, i.color, i.size) === itemKey
      );
      if (!target) return prev;
      const prod = products.find((p) => p._id === target.productId);
      const maxAvail = Math.max(1, getSourceVariantFloorStock(prod, cleanColor, cleanSize));
      const newKey = getTransferItemKey(target.productId, cleanColor, cleanSize);
      if (newKey !== itemKey && prev.some((i) => getTransferItemKey(i.productId, i.color, i.size) === newKey)) {
        // Gộp số lượng nếu biến thể mới đã có trong danh sách
        return prev
          .map((i) => {
            const k = getTransferItemKey(i.productId, i.color, i.size);
            if (k === newKey) {
              return { ...i, quantity: Math.min(maxAvail, i.quantity + target.quantity) };
            }
            return i;
          })
          .filter((i) => getTransferItemKey(i.productId, i.color, i.size) !== itemKey);
      }
      return prev.map((i) =>
        getTransferItemKey(i.productId, i.color, i.size) === itemKey
          ? {
            ...i,
            color: cleanColor,
            size: cleanSize,
            quantity: Math.min(maxAvail, i.quantity),
          }
          : i
      );
    });
  };

  const handleUpdateTransferItemQty = (itemKey: string, newQty: number) => {
    if (newQty <= 0) {
      setTransferItems((prev) =>
        prev.filter((i) => getTransferItemKey(i.productId, i.color, i.size) !== itemKey)
      );
      return;
    }
    setTransferItems((prev) =>
      prev.map((i) => {
        if (getTransferItemKey(i.productId, i.color, i.size) !== itemKey) return i;
        const prod = products.find((p) => p._id === i.productId);
        const maxAvail = Math.max(1, getSourceVariantFloorStock(prod, i.color, i.size));
        const clamped = Math.min(maxAvail, Math.max(1, Math.round(newQty)));
        return { ...i, quantity: clamped };
      })
    );
  };

  const handleRemoveTransferItem = (itemKey: string) => {
    setTransferItems((prev) =>
      prev.filter((i) => getTransferItemKey(i.productId, i.color, i.size) !== itemKey)
    );
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const activeProdId = transferProductId || sourceFloorProducts[0]?._id || "";
    const activeProd = products.find((p) => p._id === activeProdId);
    const defaultVars = getProductSourceVariants(activeProd);
    const fallbackColor =
      transferColor || (defaultVars.length > 0 ? defaultVars[0].color || "" : "");
    const fallbackSize =
      transferSize || (defaultVars.length > 0 ? defaultVars[0].size || "" : "");

    // Nếu danh sách phiếu đang trống mà Admin chọn 1 SP trên thanh chọn nhanh thì lấy luôn SP + Màu/Size đó
    const finalItems =
      transferItems.length > 0
        ? transferItems
        : activeProdId && Number(transferQty) > 0
          ? [
            {
              productId: activeProdId,
              color: fallbackColor,
              size: fallbackSize,
              quantity: Math.round(Number(transferQty)),
            },
          ]
          : [];

    if (finalItems.length === 0) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng thêm ít nhất 1 sản phẩm vào phiếu xuất kho chuyển tầng.",
      });
      return;
    }

    const fromWarehouse: WarehouseFloor =
      transferDirection === "F1_TO_F2" ? "FLOOR_1" : "FLOOR_2";
    const toWarehouse: WarehouseFloor =
      transferDirection === "F1_TO_F2" ? "FLOOR_2" : "FLOOR_1";

    try {
      const res = await apiRequest<any>("/inventory/transfers", {
        method: "POST",
        body: JSON.stringify({
          fromWarehouse,
          toWarehouse,
          items: finalItems,
          note: transferNote.trim(),
        }),
      });
      const code =
        res?.data?.referenceCode || res?.data?.movement?.referenceCode || "PXK";
      const fromText = fromWarehouse === "FLOOR_1" ? "Kho Tầng 1" : "Kho Tầng 2";
      const toText = toWarehouse === "FLOOR_1" ? "Kho Tầng 1" : "Kho Tầng 2";
      const totalUnits = finalItems.reduce((s, i) => s + i.quantity, 0);
      setStatusMsg({
        type: "success",
        text: `Đã tạo Phiếu Xuất Kho ${code}: Dời ${finalItems.length} mặt hàng (tổng ${totalUnits} SP) từ ${fromText} sang ${toText} & ghi nhận vào Hoạt động nhân viên!`,
      });
      setTransferItems([]);
      setTransferQty(1);
      setTransferNote("");
      setExpandedTransferCode(code);
      loadProductsAndCats();
      loadTransfers();
      loadMovements();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể tạo phiếu xuất kho chuyển tầng.",
      });
    }
  };

  // Tập mã hàng đã từng nhập vào Kho Tầng 1 và Kho Tầng 2 (từ danh sách Phiếu nhập)
  const floor1ImportedCodes = new Set<string>();
  const floor2ImportedCodes = new Set<string>();
  importsList.forEach((rc) => {
    const wh = rc.targetWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1";
    (rc.items || []).forEach((it: any) => {
      if (it.productCode) {
        if (wh === "FLOOR_2") floor2ImportedCodes.add(String(it.productCode));
        else floor1ImportedCodes.add(String(it.productCode));
      }
    });
  });


  return {
    sourceFloorProducts,
    getSourceFloorStock,
    getVariantSourceFloorStock,
    getProductSourceVariants,
    getSourceVariantFloorStock,
    getTransferItemKey,
    syncDefaultTransferVariantForProduct,
    handleSelectTransferProduct,
    handleChangeTransferDirection,
    handleAddTransferItem,
    handleUpdateTransferItemVariant,
    handleUpdateTransferItemQty,
    handleRemoveTransferItem,
    handleCreateTransfer,
    floor1ImportedCodes,
    floor2ImportedCodes,
  };
}
