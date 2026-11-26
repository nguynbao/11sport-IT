import type { Product } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { lookupProductByCodeApi } from "@/shared/api/catalogLookup";
import { formatVariantLabel, formatVND } from "@/shared/utils/format";
import { resolveVariantCode } from "@/shared/utils/productCode";
import { cleanBarcodeCode, findProductAndVariantByScannedBarcode, getBarcodeCandidates, playScannerBeep } from "@/shared/lib/barcodeScanner";
import { cartUnitPrice, productDisplayPrice, getCartLineKey, type CartItem } from "../types";
import type { PosStateSlice } from "./usePosState";
import type { PosCatalogSlice } from "./usePosCatalog";
import type { PosPromotionsSlice } from "./usePosPromotions";

/** Chọn sản phẩm, thêm giỏ & quét mã vạch */
export function usePosScanner(s: PosStateSlice & PosCatalogSlice & PosPromotionsSlice) {
  const {
    setVariantPickerProduct,
    setErrorMsg,
    getFloor1Stock,
    getVariantFloor1Stock,
    giftCart,
    getCartQty,
    cart,
    applyPromotionsForCart,
    allCatalogProducts,
    products,
    setAllCatalogProducts,
    setLastScanBanner,
    getCartVariantQty,
  } = s;
  // Mở popup chọn Size/Màu nếu sản phẩm có nhiều phân loại, hoặc thêm thẳng nếu chỉ có 1 phân loại
  const handleSelectProductForPos = (product: Product) => {
    const namedVariants = (product.variants || []).filter(
      (v) => (v.color || v.size) && (Number(v.stockFloor1 ?? v.stock) || 0) > 0
    );
    if (namedVariants.length > 1) {
      setVariantPickerProduct(product);
      return;
    }
    if (namedVariants.length === 1) {
      handleAddToCart(product, namedVariants[0].color, namedVariants[0].size);
      return;
    }
    const allNamed = (product.variants || []).filter((v) => v.color || v.size);
    if (allNamed.length > 0) {
      setVariantPickerProduct(product);
      return;
    }
    handleAddToCart(product, product.color || "", product.size || "");
  };

  const handleAddToCart = (
    product: Product,
    colorParam?: string,
    sizeParam?: string
  ): boolean => {
    setErrorMsg("");
    const color = String(colorParam ?? product.color ?? "").trim();
    const size = String(sizeParam ?? product.size ?? "").trim().toUpperCase();

    const floor1Stock = getFloor1Stock(product);
    const variantStock = getVariantFloor1Stock(product, color, size);
    const variantLabel = formatVariantLabel(color, size);

    if (cartUnitPrice({ product, color, size }) <= 0) {
      setErrorMsg(
        `Sản phẩm "${product.name}" chưa có giá niêm yết (> 0). Vui lòng cập nhật giá trên CMS trước khi bán.`
      );
      return false;
    }
    if (floor1Stock <= 0 || variantStock <= 0) {
      setErrorMsg(
        `Sản phẩm "${product.name}"${variantLabel ? ` (${variantLabel})` : ""} đã hết hàng tại Kho Tầng 1.`
      );
      return false;
    }

    const manualGiftedQty = giftCart
      .filter((g) => !g.isAutoPromo && g.product._id === product._id)
      .reduce((s, g) => s + g.quantity, 0);
    const totalSaleForProd = getCartQty(product._id);

    if (totalSaleForProd + manualGiftedQty + 1 > floor1Stock) {
      setErrorMsg(
        `Không được vượt tổng số lượng Kho Tầng 1 (${floor1Stock} ${product.unit}) của "${product.name}".`
      );
      return false;
    }

    const lineKey = getCartLineKey(product._id, color, size);
    const existing = cart.find(
      (c) => getCartLineKey(c.product._id, c.color, c.size) === lineKey
    );
    const currentVariantQty = existing ? existing.quantity : 0;

    if ((color || size) && currentVariantQty + 1 > variantStock) {
      setErrorMsg(
        `Phân loại "${variantLabel}" của "${product.name}" chỉ còn ${variantStock} ${product.unit} tại Kho Tầng 1.`
      );
      return false;
    }

    const nextCart: CartItem[] = existing
      ? cart.map((c) =>
        getCartLineKey(c.product._id, c.color, c.size) === lineKey
          ? { ...c, quantity: c.quantity + 1 }
          : c
      )
      : [
        ...cart,
        {
          product,
          color,
          size,
          quantity: 1,
          discountType: "NONE",
          discountValue: 0,
        },
      ];

    applyPromotionsForCart(nextCart, giftCart);
    return true;
  };

  /**
   * Xử lý khi Máy Quét Label bắn mã sản phẩm vào màn hình POS (Quét bán hàng):
   * - Tự động khử lỗi bộ gõ Tiếng Việt (Unikey Telex) & khớp Mã SP chung (hoặc kèm Size/Màu).
   * - Nếu SP chỉ có 1 phân loại còn hàng ở Tầng 1: cộng ngay +1 vào Giỏ hàng + phát tiếng Bíp.
   * - Nếu SP có nhiều Size/Màu ở Tầng 1: bật Popup chọn nhanh Size/Màu (hỗ trợ bấm phím số 1..9).
   */
  const handleBarcodeScanForPos = async (rawInput: string) => {
    const trimmed = String(rawInput || "").trim();
    if (!trimmed) return;

    const nowStr = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const candidates = getBarcodeCandidates(trimmed);
    const displayCode = candidates[1] || candidates[0] || cleanBarcodeCode(trimmed) || trimmed.toUpperCase();

    const sourceCatalog = allCatalogProducts.length > 0 ? allCatalogProducts : products;
    let scanRes = findProductAndVariantByScannedBarcode(sourceCatalog, trimmed);
    // v5.0: tra cứu server theo mã mới / mã con / mã cũ (legacy) / mã rút gọn tem cũ
    if (!scanRes) {
      try {
        const hit = await lookupProductByCodeApi(trimmed);
        if (hit?.product) {
          const v = hit.variant;
          scanRes = {
            product: hit.product,
            matchedVariant: v
              ? {
                  ...v,
                  variantCode: v.variantCode || v.barcode || hit.product.code,
                  stockFloor1: Number(v.stockFloor1 || 0),
                  stockFloor2: Number(v.stockFloor2 || 0),
                  stock: Number(v.stock || 0),
                }
              : undefined,
            isVariantExactMatch: Boolean(v),
          };
        }
      } catch {
        // ignore -> thử tải lại danh mục
      }
    }
    if (!scanRes) {
      try {
        const freshRes = await apiRequest<Product[]>("/products");
        const freshPool = Array.isArray(freshRes.data) ? freshRes.data : [];
        if (freshPool.length > 0) {
          setAllCatalogProducts(freshPool);
          scanRes = findProductAndVariantByScannedBarcode(freshPool, trimmed);
        }
      } catch {
        // ignore network error
      }
    }
    const matchedProduct = scanRes?.product || null;

    if (!matchedProduct) {
      playScannerBeep("error");
      const msg = `Không tìm thấy sản phẩm có mã "${displayCode}" trong danh mục kho!`;
      setErrorMsg(msg);
      setLastScanBanner({
        type: "error",
        code: displayCode,
        message: msg,
        time: nowStr,
      });
      return;
    }

    if (productDisplayPrice(matchedProduct).price <= 0) {
      playScannerBeep("error");
      const msg = `Mã ${matchedProduct.code} ("${matchedProduct.name}") chưa có giá niêm yết (> 0đ). Vui lòng cập nhật giá trên CMS.`;
      setErrorMsg(msg);
      setLastScanBanner({
        type: "error",
        code: matchedProduct.code,
        message: msg,
        time: nowStr,
      });
      return;
    }

    const f1Stock = getFloor1Stock(matchedProduct);
    const f2Stock = Number(matchedProduct.stockFloor2 || 0);
    if (f1Stock <= 0) {
      playScannerBeep("error");
      const msg = `Mã ${matchedProduct.code} ("${matchedProduct.name}") đã HẾT HÀNG tại Kho Tầng 1${f2Stock > 0 ? ` (Đang còn ${f2Stock} ${matchedProduct.unit} ở Kho Tầng 2)` : ""
        }!`;
      setErrorMsg(msg);
      setLastScanBanner({
        type: "error",
        code: matchedProduct.code,
        message: msg,
        time: nowStr,
      });
      return;
    }

    // Nếu quét trúng trực tiếp Mã con thuộc tính (VD: GASIA221401DO38) -> Cộng thẳng phân loại đó vào giỏ!
    if (scanRes?.matchedVariant && scanRes.isVariantExactMatch) {
      const exactVar = scanRes.matchedVariant;
      const childCode =
        exactVar.variantCode ||
        resolveVariantCode(matchedProduct, matchedProduct.code, exactVar.color, exactVar.size);
      const added = handleAddToCart(matchedProduct, exactVar.color, exactVar.size);
      if (added) {
        playScannerBeep("success");
        const vLabel = formatVariantLabel(exactVar.color, exactVar.size);
        const newQtyInCart =
          getCartVariantQty(matchedProduct._id, exactVar.color, exactVar.size) + 1;
        setLastScanBanner({
          type: "success",
          code: childCode,
          message: `Đã quét mã con ${childCode} → +1 "${matchedProduct.name}"${vLabel ? ` (${vLabel})` : ""
            } • ${formatVND(cartUnitPrice({ product: matchedProduct, color: exactVar.color, size: exactVar.size }))} (Trong giỏ: ${newQtyInCart} ${matchedProduct.unit})`,
          time: nowStr,
        });
        setVariantPickerProduct(null);
      } else {
        playScannerBeep("error");
      }
      return;
    }

    const availableVariants = (matchedProduct.variants || []).filter(
      (v) => (v.color || v.size) && (Number(v.stockFloor1 ?? v.stock) || 0) > 0
    );

    // Kiểm tra nếu chuỗi quét có hậu tố chỉ định rõ Size / Màu (VD: "GASIA221401 41" hoặc "GASIA221401-L")
    const parts = trimmed.split(/[-_/:|\s]+/).slice(1);
    if (parts.length > 0 && availableVariants.length > 0) {
      const suffixNorm = cleanBarcodeCode(parts.join(""));
      const matchedVariant = availableVariants.find((v) => {
        const vSize = cleanBarcodeCode(v.size || "");
        const vColor = cleanBarcodeCode(v.color || "");
        const vCombo = cleanBarcodeCode(`${v.color || ""}${v.size || ""}`);
        return (
          suffixNorm === vSize ||
          suffixNorm === vColor ||
          suffixNorm === vCombo ||
          cleanBarcodeCode(`${v.size || ""}${v.color || ""}`) === suffixNorm
        );
      });
      if (matchedVariant) {
        const added = handleAddToCart(matchedProduct, matchedVariant.color, matchedVariant.size);
        if (added) {
          playScannerBeep("success");
          const vLabel = formatVariantLabel(matchedVariant.color, matchedVariant.size);
          setLastScanBanner({
            type: "success",
            code: matchedProduct.code,
            message: `Đã quét ${matchedProduct.code} → +1 "${matchedProduct.name}" (${vLabel}) • ${formatVND(cartUnitPrice({ product: matchedProduct, color: matchedVariant.color, size: matchedVariant.size }))}`,
            time: nowStr,
          });
          setVariantPickerProduct(null);
        } else {
          playScannerBeep("error");
        }
        return;
      }
    }

    // Nếu sản phẩm có từ 2 phân loại (Màu/Size) trở lên đang còn tồn ở Tầng 1 -> Mở Popup chọn nhanh
    if (availableVariants.length > 1) {
      playScannerBeep("warning");
      setVariantPickerProduct(matchedProduct);
      setLastScanBanner({
        type: "warning",
        code: matchedProduct.code,
        message: `Đã quét ${matchedProduct.code} ("${matchedProduct.name}") — Bấm phím số [1..${availableVariants.length}] hoặc click chọn Màu/Size để thêm vào giỏ!`,
        time: nowStr,
      });
      return;
    }

    // Nếu chỉ có 1 phân loại còn hàng hoặc sản phẩm không chia Size/Màu -> Thêm thẳng +1 vào giỏ
    const targetColor =
      availableVariants.length === 1
        ? availableVariants[0].color
        : matchedProduct.color || "";
    const targetSize =
      availableVariants.length === 1
        ? availableVariants[0].size
        : matchedProduct.size || "";

    const added = handleAddToCart(matchedProduct, targetColor, targetSize);
    if (added) {
      playScannerBeep("success");
      const vLabel = formatVariantLabel(targetColor, targetSize);
      const newQtyInCart = getCartVariantQty(matchedProduct._id, targetColor, targetSize) + 1;
      setLastScanBanner({
        type: "success",
        code: matchedProduct.code,
        message: `Đã quét ${matchedProduct.code} → +1 "${matchedProduct.name}"${vLabel ? ` (${vLabel})` : ""
          } • ${formatVND(cartUnitPrice({ product: matchedProduct, color: targetColor, size: targetSize }))} (Trong giỏ: ${newQtyInCart} ${matchedProduct.unit})`,
        time: nowStr,
      });
      setVariantPickerProduct(null);
    } else {
      playScannerBeep("error");
      setLastScanBanner({
        type: "error",
        code: matchedProduct.code,
        message: `Không thể thêm thêm "${matchedProduct.name}" (Đã chạm trần tồn Kho Tầng 1: ${f1Stock} ${matchedProduct.unit}).`,
        time: nowStr,
      });
    }
  };

  return {
    handleSelectProductForPos,
    handleAddToCart,
    handleBarcodeScanForPos,
  };
}

export type PosScannerSlice = ReturnType<typeof usePosScanner>;
