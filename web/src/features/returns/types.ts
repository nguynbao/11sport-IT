import type { Product } from "@/shared/types";
import { findVariantByColorSize, variantEffectiveSellingPrice } from "@/shared/utils/productCode";

export interface ReturnItemForm {
  lineIndex: number;
  productId: string;
  productCode: string;
  productName: string;
  color: string;
  size: string;
  isGift: boolean;
  originalUnitPrice: number;
  unitPrice: number;
  maxReturnable: number;
  quantity: number;
  condition: "GOOD" | "DAMAGED";
}

export interface ExchangeOption {
  optionKey: string;
  product: Product;
  color: string;
  size: string;
  colorHexes: string[];
  variantCode: string;
  displayName: string;
  directFloor1: number;
  unpackableFloor1: number;
  stockFloor1: number;
}

export interface ExchangeItemForm {
  optionKey: string;
  product: Product;
  color: string;
  size: string;
  variantCode: string;
  displayName: string;
  stockFloor1: number;
  quantity: number;
  discountType: "NONE" | "PERCENT" | "AMOUNT";
  discountValue: number;
  discountInputMode?: "NONE" | "PERCENT" | "AMOUNT" | "PRICE";
  customPriceText?: string;
}

/** R8 (v5.0): hàng đổi mới dùng giá bán hiệu lực của biến thể (Màu+Size), trống => giá gốc */
export const exchangeUnitPrice = (ex: { product: Product; color?: string; size?: string }): number =>
  Math.max(
    0,
    Math.round(
      variantEffectiveSellingPrice(ex.product, findVariantByColorSize(ex.product, ex.color, ex.size)) || 0
    )
  );

export const getExchangeItemPricing = (ex: ExchangeItemForm) => {
  const originalUnitPrice = exchangeUnitPrice(ex);
  const rawDiscVal = Math.max(0, Number(ex.discountValue) || 0);
  const discountPerUnit =
    ex.discountType === "PERCENT"
      ? Math.round((originalUnitPrice * Math.min(100, rawDiscVal)) / 100)
      : ex.discountType === "AMOUNT"
        ? Math.min(originalUnitPrice, Math.round(rawDiscVal))
        : 0;
  const unitPrice = Math.max(0, originalUnitPrice - discountPerUnit);
  const discountAmount = discountPerUnit * ex.quantity;
  const lineTotal = unitPrice * ex.quantity;
  return {
    originalUnitPrice,
    discountPerUnit,
    unitPrice,
    discountAmount,
    lineTotal,
  };
};
