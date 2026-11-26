import { useEffect, useMemo } from "react";
import type { Product, DiscountType } from "@/shared/types";
import { formatNumberDots, formatVariantLabel } from "@/shared/utils/format";
import { filterAndRankBySearch } from "@/shared/lib/search";
import { playScannerBeep, useHardwareBarcodeScanner } from "@/shared/lib/barcodeScanner";
import { cartUnitPrice, getCartLineKey, type GiftCartItem, type CartItem } from "../types";
import type { PosStateSlice } from "./usePosState";
import type { PosCatalogSlice } from "./usePosCatalog";
import type { PosPromotionsSlice } from "./usePosPromotions";
import type { PosScannerSlice } from "./usePosScanner";

/** Thao tác giỏ hàng, quà tặng, giảm giá dòng */
export function usePosCart(s: PosStateSlice & PosCatalogSlice & PosPromotionsSlice & PosScannerSlice) {
  const {
    scannerEnabled,
    showGiftModal,
    posMode,
    handleBarcodeScanForPos,
    variantPickerProduct,
    setVariantPickerProduct,
    getCartVariantQty,
    handleAddToCart,
    setLastScanBanner,
    setErrorMsg,
    giftCart,
    cart,
    getFloor1Stock,
    getVariantFloor1Stock,
    applyPromotionsForCart,
    getCartQty,
    setGiftCart,
    floor1Products,
    pinnedGiftIds,
    debouncedGiftSearch,
    giftCategoryId,
    getCategoryId,
    getCategoryName,
    categories,
    setCart,
  } = s;
  // Lắng nghe máy quét mã vạch toàn cục (không cần đặt chuột vào ô input vẫn quét bán hàng được)
  useHardwareBarcodeScanner({
    enabled: scannerEnabled && !showGiftModal && posMode === "PRODUCTS",
    onScan: (scannedCode) => {
      handleBarcodeScanForPos(scannedCode);
    },
  });

  // Phím tắt chọn nhanh biến thể [1..9] hoặc Escape khi Popup chọn Size/Màu đang mở
  useEffect(() => {
    if (!variantPickerProduct || typeof window === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase() || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        e.preventDefault();
        setVariantPickerProduct(null);
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const variants = variantPickerProduct.variants || [];
        const picked = variants[idx];
        if (picked) {
          const vFloor1 = Math.max(0, Number(picked.stockFloor1 ?? picked.stock) || 0);
          const inCartQty = getCartVariantQty(
            variantPickerProduct._id,
            picked.color,
            picked.size
          );
          if (vFloor1 > 0 && inCartQty < vFloor1) {
            e.preventDefault();
            const added = handleAddToCart(variantPickerProduct, picked.color, picked.size);
            if (added) {
              playScannerBeep("success");
              const vLabel = formatVariantLabel(picked.color, picked.size);
              setLastScanBanner({
                type: "success",
                code: variantPickerProduct.code,
                message: `Đã chọn [${idx + 1}] ${vLabel} của "${variantPickerProduct.name}" (+1 vào giỏ hàng)`,
                time: new Date().toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
              });
              setVariantPickerProduct(null);
            }
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleChangeQty = (
    productId: string,
    newQty: number,
    color?: string,
    size?: string
  ) => {
    setErrorMsg("");
    const lineKey = getCartLineKey(productId, color, size);
    const manualGiftedQty = giftCart
      .filter((g) => !g.isAutoPromo && g.product._id === productId)
      .reduce((s, g) => s + g.quantity, 0);

    const otherVariantsQty = cart
      .filter(
        (c) =>
          c.product._id === productId &&
          getCartLineKey(c.product._id, c.color, c.size) !== lineKey
      )
      .reduce((s, c) => s + c.quantity, 0);

    const nextCart = cart
      .map((c) => {
        if (getCartLineKey(c.product._id, c.color, c.size) !== lineKey) return c;
        if (newQty <= 0) return null;
        const floor1Stock = getFloor1Stock(c.product);
        const variantStock = getVariantFloor1Stock(c.product, c.color, c.size);
        const maxByTotal = Math.max(
          0,
          floor1Stock - manualGiftedQty - otherVariantsQty
        );
        const maxAllowedForSale =
          c.color || c.size ? Math.min(maxByTotal, variantStock) : maxByTotal;

        if (newQty > maxAllowedForSale) {
          const vLabel = formatVariantLabel(c.color, c.size);
          setErrorMsg(
            `Không được vượt tồn Kho Tầng 1 của "${c.product.name}"${vLabel ? ` (${vLabel})` : ""} (Tối đa: ${maxAllowedForSale} ${c.product.unit}).`
          );
          return maxAllowedForSale > 0
            ? { ...c, quantity: maxAllowedForSale }
            : null;
        }
        return { ...c, quantity: newQty };
      })
      .filter(Boolean) as CartItem[];

    applyPromotionsForCart(nextCart, giftCart);
  };

  const handleAddGiftProduct = (product: Product) => {
    setErrorMsg("");
    const floor1Stock = getFloor1Stock(product);
    const saleQty = getCartQty(product._id);
    if (floor1Stock - saleQty <= 0) {
      setErrorMsg(
        `Sản phẩm "${product.name}" không còn đủ tồn Kho Tầng 1 để tặng thêm (Tồn T1: ${floor1Stock}, đang bán: ${saleQty}).`
      );
      return;
    }

    setGiftCart((prev) => {
      const existing = prev.find((g) => g.product._id === product._id);
      const currentGiftQty = existing ? existing.quantity : 0;
      if (saleQty + currentGiftQty + 1 > floor1Stock) {
        setErrorMsg(
          `Không được tặng vượt tồn Kho Tầng 1 (${floor1Stock} ${product.unit}) của "${product.name}".`
        );
        return prev;
      }
      if (existing) {
        return prev.map((g) =>
          g.product._id === product._id ? { ...g, quantity: g.quantity + 1 } : g
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleChangeGiftQty = (productId: string, newQty: number) => {
    setErrorMsg("");
    const saleQty = getCartQty(productId);
    setGiftCart((prev) =>
      prev
        .map((g) => {
          if (g.product._id !== productId) return g;
          if (newQty <= 0) return null;
          const floor1Stock = getFloor1Stock(g.product);
          const maxGiftAllowed = Math.max(0, floor1Stock - saleQty);
          if (newQty > maxGiftAllowed) {
            setErrorMsg(
              `Không được tặng vượt tồn Kho Tầng 1 của "${g.product.name}" (Tối đa tặng thêm: ${maxGiftAllowed} ${g.product.unit}).`
            );
            return maxGiftAllowed > 0 ? { ...g, quantity: maxGiftAllowed } : null;
          }
          return { ...g, quantity: newQty };
        })
        .filter(Boolean) as GiftCartItem[]
    );
  };

  const pinnedFloor1Count = useMemo(
    () => floor1Products.filter((p) => pinnedGiftIds.includes(p._id)).length,
    [floor1Products, pinnedGiftIds]
  );

  const popupGiftProducts = useMemo(() => {
    const q = debouncedGiftSearch.trim();

    const categoryFiltered = floor1Products.filter((p) => {
      if (giftCategoryId === "PINNED") {
        if (!pinnedGiftIds.includes(p._id)) return false;
      } else if (
        giftCategoryId &&
        giftCategoryId !== "ALL" &&
        getCategoryId(p) !== giftCategoryId
      ) {
        return false;
      }
      return true;
    });

    if (q) {
      return filterAndRankBySearch(categoryFiltered, q, (p) => [
        { text: p.code, weight: 1.5 },
        { text: p.barcode, weight: 1.5 },
        { text: p.name, weight: 1.3 },
        { text: getCategoryName(p), weight: 0.9 },
      ]);
    }

    return [...categoryFiltered].sort((a, b) => {
      const aPinned = pinnedGiftIds.includes(a._id);
      const bPinned = pinnedGiftIds.includes(b._id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      if (aPinned && bPinned) {
        return pinnedGiftIds.indexOf(a._id) - pinnedGiftIds.indexOf(b._id);
      }
      return (a.name || "").localeCompare(b.name || "", "vi");
    });
  }, [floor1Products, giftCategoryId, debouncedGiftSearch, pinnedGiftIds, categories]);

  const handleChangeItemDiscount = (
    productId: string,
    discountType: DiscountType,
    rawVal: number,
    color?: string,
    size?: string,
    discountInputMode?: "NONE" | "PERCENT" | "AMOUNT" | "PRICE",
    customPriceText?: string
  ) => {
    const lineKey = getCartLineKey(productId, color, size);
    setCart((prev) =>
      prev.map((c) => {
        if (getCartLineKey(c.product._id, c.color, c.size) !== lineKey) return c;
        const origPrice = cartUnitPrice(c);
        let cleanVal = Math.max(0, rawVal);
        if (discountType === "PERCENT") {
          cleanVal = Math.min(100, cleanVal);
        } else if (discountType === "AMOUNT") {
          cleanVal = Math.min(origPrice, Math.round(cleanVal));
        } else {
          cleanVal = 0;
        }
        const resolvedMode =
          discountInputMode ||
          (discountType === "PERCENT"
            ? "PERCENT"
            : discountType === "AMOUNT"
              ? "AMOUNT"
              : "NONE");
        return {
          ...c,
          discountType,
          discountValue: cleanVal,
          discountInputMode: resolvedMode,
          customPriceText:
            resolvedMode === "PRICE"
              ? customPriceText !== undefined
                ? customPriceText
                : formatNumberDots(Math.max(0, origPrice - cleanVal))
              : undefined,
          isManualDiscount: true,
          autoPromoName: undefined,
        };
      })
    );
  };

  const handleChangeItemDesiredPrice = (
    productId: string,
    rawText: string,
    color?: string,
    size?: string
  ) => {
    const lineKey = getCartLineKey(productId, color, size);
    const digits = rawText.replace(/[^\d]/g, "");
    setCart((prev) =>
      prev.map((c) => {
        if (getCartLineKey(c.product._id, c.color, c.size) !== lineKey) return c;
        const origPrice = cartUnitPrice(c);
        if (!digits) {
          return {
            ...c,
            discountType: "NONE",
            discountValue: 0,
            discountInputMode: "NONE",
            customPriceText: "",
            isManualDiscount: false,
            autoPromoName: undefined,
          };
        }
        const enteredPrice = Math.min(origPrice, Math.max(0, Number(digits) || 0));
        const computedDiscount = Math.max(0, origPrice - enteredPrice);
        return {
          ...c,
          discountType: computedDiscount > 0 ? "AMOUNT" : "NONE",
          discountValue: computedDiscount,
          discountInputMode: "PRICE",
          customPriceText: formatNumberDots(enteredPrice),
          isManualDiscount: computedDiscount > 0,
          autoPromoName: undefined,
        };
      })
    );
  };

  const getItemPricing = (item: CartItem) => {
    const originalUnitPrice = cartUnitPrice(item);
    const discountPerUnit =
      item.discountType === "PERCENT"
        ? Math.round((originalUnitPrice * item.discountValue) / 100)
        : item.discountType === "AMOUNT"
          ? Math.min(originalUnitPrice, Math.round(item.discountValue))
          : 0;
    const unitPrice = Math.max(0, originalUnitPrice - discountPerUnit);
    const discountAmount = discountPerUnit * item.quantity;
    const lineTotal = unitPrice * item.quantity;
    return {
      originalUnitPrice,
      discountPerUnit,
      unitPrice,
      discountAmount,
      lineTotal,
    };
  };

  const giftUnitsCount = giftCart.reduce((sum, g) => sum + g.quantity, 0);

  return {
    handleChangeQty,
    handleAddGiftProduct,
    handleChangeGiftQty,
    pinnedFloor1Count,
    popupGiftProducts,
    handleChangeItemDiscount,
    handleChangeItemDesiredPrice,
    getItemPricing,
    giftUnitsCount,
  };
}

export type PosCartSlice = ReturnType<typeof usePosCart>;
