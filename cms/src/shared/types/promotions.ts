export type PromotionConditionType = "BUY_PRODUCTS" | "BUY_CATEGORY" | "ALL_PRODUCTS";
export type PromotionDiscountType = "NONE" | "PERCENT" | "AMOUNT";
export type EffectivePromotionStatus =
  | "RUNNING_PERMANENT"
  | "RUNNING"
  | "UPCOMING"
  | "EXPIRED"
  | "PAUSED";

export interface PromotionConditionProduct {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  sellingPrice?: number;
  stockFloor1?: number;
}

export interface PromotionConditionCategory {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
}

export interface PromotionGiftItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  sellingPrice?: number;
  stockFloor1?: number;
}

export interface Promotion {
  _id: string;
  code: string;
  name: string;
  description: string;
  status: "ACTIVE" | "PAUSED";
  isPermanent: boolean;
  startDate?: string | null;
  endDate?: string | null;
  conditionType: PromotionConditionType;
  conditionProductIds: string[];
  conditionProducts: PromotionConditionProduct[];
  conditionCategoryIds: string[];
  conditionCategories: PromotionConditionCategory[];
  minQuantity: number;
  minOrderAmount: number;
  giftItems: PromotionGiftItem[];
  multiplyGiftByConditionQty: boolean;
  itemDiscountType: PromotionDiscountType;
  itemDiscountValue: number;
  billDiscountType: PromotionDiscountType;
  billDiscountValue: number;
  isCurrentlyActive?: boolean;
  effectiveStatus?: EffectivePromotionStatus;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}


/**
 * Tính chính xác số lượng module (dots ở 1x) của chuỗi khi mã hóa Code 128 Auto (B + C).
 */

