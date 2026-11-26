import { useCallback } from "react";
import type { Product, Promotion, DiscountType } from "@/shared/types";
import { formatVND } from "@/shared/utils/format";
import { cartUnitPrice, getCartLineKey, type GiftCartItem, type CartItem } from "../types";
import type { PosStateSlice } from "./usePosState";
import type { PosDraftsSlice } from "./usePosDrafts";
import type { PosCatalogSlice } from "./usePosCatalog";

/** Số lượng trong giỏ & áp dụng khuyến mãi */
export function usePosPromotions(s: PosStateSlice & PosDraftsSlice & PosCatalogSlice) {
  const {
    cart,
    giftCart,
    getCategoryId,
    activePromotions,
    categories,
    getFloor1Stock,
    catalogById,
    products,
    setCart,
    setGiftCart,
    setAppliedPromosSummary,
    isManualBillDiscount,
    setBillDiscountType,
    setBillDiscountValue,
    setAutoBillPromoName,
    autoBillPromoName,
  } = s;
  const getCartQty = (productId: string): number => {
    return cart
      .filter((c) => c.product._id === productId)
      .reduce((sum, c) => sum + c.quantity, 0);
  };

  const getCartVariantQty = (productId: string, color?: string, size?: string): number => {
    const key = getCartLineKey(productId, color, size);
    return cart
      .filter((c) => getCartLineKey(c.product._id, c.color, c.size) === key)
      .reduce((sum, c) => sum + c.quantity, 0);
  };

  const getGiftQty = (productId: string): number => {
    return giftCart
      .filter((g) => g.product._id === productId)
      .reduce((sum, g) => sum + g.quantity, 0);
  };

  const getProductPromotions = useCallback(
    (p: Product): Promotion[] => {
      const catId = getCategoryId(p);
      return activePromotions.filter((promo) => {
        if (!promo.isCurrentlyActive) return false;
        if (promo.conditionType === "BUY_PRODUCTS") {
          return (promo.conditionProductIds || []).includes(p._id);
        }
        if (promo.conditionType === "BUY_CATEGORY") {
          return (promo.conditionCategoryIds || []).includes(catId);
        }
        return promo.conditionType === "ALL_PRODUCTS";
      });
    },
    [activePromotions, categories]
  );

  const applyPromotionsForCart = useCallback(
    (
      rawNextCart: CartItem[],
      currentGiftCart: GiftCartItem[],
      promos: Promotion[] = activePromotions
    ) => {
      const rawCartAmount = rawNextCart.reduce(
        (s, ci) => s + cartUnitPrice(ci) * ci.quantity,
        0
      );

      const nextAppliedSummary: {
        _id: string;
        code: string;
        name: string;
        multiplier: number;
        details: string[];
      }[] = [];

      const autoGiftMap = new Map<
        string,
        {
          giftInfo: any;
          requestedQty: number;
          promoNames: string[];
        }
      >();

      const itemDiscMap = new Map<
        string,
        {
          discountType: DiscountType;
          discountValue: number;
          discountPerUnit: number;
          promoName: string;
        }
      >();

      let bestBillDisc: {
        discountType: DiscountType;
        discountValue: number;
        estAmount: number;
        promoName: string;
      } | null = null;

      for (const promo of promos) {
        if (!promo.isCurrentlyActive) continue;

        let matchingItems: CartItem[] = [];
        if (promo.conditionType === "BUY_PRODUCTS") {
          const setIds = new Set((promo.conditionProductIds || []).map(String));
          matchingItems = rawNextCart.filter((ci) =>
            setIds.has(String(ci.product._id))
          );
        } else if (promo.conditionType === "BUY_CATEGORY") {
          const setCatIds = new Set(
            (promo.conditionCategoryIds || []).map(String)
          );
          matchingItems = rawNextCart.filter((ci) =>
            setCatIds.has(getCategoryId(ci.product))
          );
        } else {
          matchingItems = [...rawNextCart];
        }

        const matchedQty = matchingItems.reduce((s, ci) => s + ci.quantity, 0);
        const minQty = Math.max(1, Number(promo.minQuantity) || 1);
        const minOrderAmt = Math.max(0, Number(promo.minOrderAmount) || 0);

        if (
          matchingItems.length === 0 ||
          matchedQty < minQty ||
          rawCartAmount < minOrderAmt
        ) {
          continue;
        }

        const multiplier =
          promo.multiplyGiftByConditionQty !== false
            ? Math.max(1, Math.floor(matchedQty / minQty))
            : 1;

        const details: string[] = [];

        for (const g of promo.giftItems || []) {
          const gid = String(g.productId);
          const addQty = Math.max(1, Number(g.quantity) || 1) * multiplier;
          const prev = autoGiftMap.get(gid);
          if (prev) {
            prev.requestedQty += addQty;
            if (!prev.promoNames.includes(promo.name)) {
              prev.promoNames.push(promo.name);
            }
          } else {
            autoGiftMap.set(gid, {
              giftInfo: g,
              requestedQty: addQty,
              promoNames: [promo.name],
            });
          }
          details.push(`🎁 Tặng ${addQty} ${g.unit || "Cái"} ${g.productName}`);
        }

        if (
          promo.itemDiscountType &&
          promo.itemDiscountType !== "NONE" &&
          promo.itemDiscountValue > 0
        ) {
          for (const ci of matchingItems) {
            const pid = ci.product._id;
            const origPrice = cartUnitPrice(ci);
            const discPerUnit =
              promo.itemDiscountType === "PERCENT"
                ? Math.round((origPrice * promo.itemDiscountValue) / 100)
                : Math.min(origPrice, Math.round(promo.itemDiscountValue));

            const prev = itemDiscMap.get(pid);
            if (!prev || discPerUnit > prev.discountPerUnit) {
              itemDiscMap.set(pid, {
                discountType: promo.itemDiscountType as DiscountType,
                discountValue: promo.itemDiscountValue,
                discountPerUnit: discPerUnit,
                promoName: promo.name,
              });
            }
          }
          details.push(
            `🏷️ Giảm ${promo.itemDiscountType === "PERCENT"
              ? `${promo.itemDiscountValue}%`
              : `${formatVND(promo.itemDiscountValue)}/SP`
            }`
          );
        }

        if (
          promo.billDiscountType &&
          promo.billDiscountType !== "NONE" &&
          promo.billDiscountValue > 0
        ) {
          const estAmt =
            promo.billDiscountType === "PERCENT"
              ? Math.round((rawCartAmount * promo.billDiscountValue) / 100)
              : Math.min(rawCartAmount, Math.round(promo.billDiscountValue));
          if (!bestBillDisc || estAmt > bestBillDisc.estAmount) {
            bestBillDisc = {
              discountType: promo.billDiscountType as DiscountType,
              discountValue: promo.billDiscountValue,
              estAmount: estAmt,
              promoName: promo.name,
            };
          }
          details.push(
            `🧾 Giảm Bill ${promo.billDiscountType === "PERCENT"
              ? `${promo.billDiscountValue}%`
              : formatVND(promo.billDiscountValue)
            }`
          );
        }

        nextAppliedSummary.push({
          _id: promo._id,
          code: promo.code,
          name: promo.name,
          multiplier,
          details,
        });
      }

      const nextCartWithDiscounts: CartItem[] = rawNextCart.map((c) => {
        if (c.isManualDiscount) return c;
        const autoDisc = itemDiscMap.get(c.product._id);
        if (autoDisc) {
          return {
            ...c,
            discountType: autoDisc.discountType,
            discountValue: autoDisc.discountValue,
            autoPromoName: autoDisc.promoName,
          };
        }
        if (c.autoPromoName) {
          return {
            ...c,
            discountType: "NONE",
            discountValue: 0,
            autoPromoName: undefined,
          };
        }
        return c;
      });

      const manualGifts = currentGiftCart
        .filter((g) => !g.isAutoPromo)
        .map((g) => {
          const inSale = nextCartWithDiscounts
            .filter((c) => c.product._id === g.product._id)
            .reduce((s, c) => s + c.quantity, 0);
          const maxGift = Math.max(0, getFloor1Stock(g.product) - inSale);
          return maxGift > 0
            ? { ...g, quantity: Math.min(g.quantity, maxGift) }
            : null;
        })
        .filter(Boolean) as GiftCartItem[];

      const autoGifts: GiftCartItem[] = [];
      for (const [gid, entry] of Array.from(autoGiftMap.entries())) {
        const foundProd =
          catalogById.get(gid) ||
          products.find((p) => p._id === gid) ||
          ({
            _id: gid,
            code: entry.giftInfo.productCode || "",
            name: entry.giftInfo.productName || "Sản phẩm tặng kèm",
            categoryId: "",
            unit: entry.giftInfo.unit || "Cái",
            sellingPrice: Number(entry.giftInfo.sellingPrice) || 0,
            stockFloor1: Number(entry.giftInfo.stockFloor1) || 0,
            stock: Number(entry.giftInfo.stockFloor1) || 0,
          } as Product);

        const floor1Stock = getFloor1Stock(foundProd);
        const inSale = nextCartWithDiscounts
          .filter((c) => c.product._id === gid)
          .reduce((s, c) => s + c.quantity, 0);
        const inManual =
          manualGifts.find((m) => m.product._id === gid)?.quantity || 0;
        const available = Math.max(0, floor1Stock - inSale - inManual);
        const finalQty = Math.min(entry.requestedQty, available);

        if (finalQty > 0) {
          autoGifts.push({
            product: foundProd,
            quantity: finalQty,
            isAutoPromo: true,
            promoName: entry.promoNames.join(", "),
          });
        }
      }

      setCart(nextCartWithDiscounts);
      setGiftCart([...autoGifts, ...manualGifts]);
      setAppliedPromosSummary(nextAppliedSummary);

      if (!isManualBillDiscount) {
        if (bestBillDisc) {
          setBillDiscountType(bestBillDisc.discountType);
          setBillDiscountValue(bestBillDisc.discountValue);
          setAutoBillPromoName(bestBillDisc.promoName);
        } else if (autoBillPromoName) {
          setBillDiscountType("NONE");
          setBillDiscountValue(0);
          setAutoBillPromoName("");
        }
      }
    },
    [
      activePromotions,
      products,
      categories,
      isManualBillDiscount,
      autoBillPromoName,
    ]
  );

  return {
    getCartQty,
    getCartVariantQty,
    getGiftQty,
    getProductPromotions,
    applyPromotionsForCart,
  };
}

export type PosPromotionsSlice = ReturnType<typeof usePosPromotions>;
