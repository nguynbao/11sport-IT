import mongoose, { Schema, Document } from 'mongoose';

export type PromotionStatus = 'ACTIVE' | 'PAUSED';
export type PromotionConditionType = 'BUY_PRODUCTS' | 'BUY_CATEGORY' | 'ALL_PRODUCTS';
export type PromotionDiscountType = 'NONE' | 'PERCENT' | 'AMOUNT';

export interface IPromotionConditionProduct {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
}

export interface IPromotionConditionCategory {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
}

export interface IPromotionGiftItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
}

export interface IPromotion extends Document {
  code: string;
  name: string;
  description: string;
  status: PromotionStatus;
  /** true = Chạy vĩnh viễn; false = Chạy theo khoảng thời gian startDate -> endDate */
  isPermanent: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  conditionType: PromotionConditionType;
  conditionProductIds: string[];
  conditionProducts: IPromotionConditionProduct[];
  conditionCategoryIds: string[];
  conditionCategories: IPromotionConditionCategory[];
  minQuantity: number;
  minOrderAmount: number;
  giftItems: IPromotionGiftItem[];
  /** true = Mua 1 tặng 1 -> Mua 2 tặng 2 (nhân theo bội số SL mua); false = Tặng cố định 1 suất/đơn */
  multiplyGiftByConditionQty: boolean;
  itemDiscountType: PromotionDiscountType;
  itemDiscountValue: number;
  billDiscountType: PromotionDiscountType;
  billDiscountValue: number;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionConditionProductSchema = new Schema<IPromotionConditionProduct>(
  {
    productId: { type: String, required: true },
    productCode: { type: String, default: '' },
    productName: { type: String, default: '' },
    unit: { type: String, default: 'Cái' },
  },
  { _id: false }
);

const PromotionConditionCategorySchema = new Schema<IPromotionConditionCategory>(
  {
    categoryId: { type: String, required: true },
    categoryCode: { type: String, default: '' },
    categoryName: { type: String, default: '' },
  },
  { _id: false }
);

const PromotionGiftItemSchema = new Schema<IPromotionGiftItem>(
  {
    productId: { type: String, required: true },
    productCode: { type: String, default: '' },
    productName: { type: String, default: '' },
    unit: { type: String, default: 'Cái' },
    quantity: { type: Number, required: true, default: 1, min: 1 },
  },
  { _id: false }
);

const PromotionSchema = new Schema<IPromotion>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: { type: String, enum: ['ACTIVE', 'PAUSED'], default: 'ACTIVE' },
    isPermanent: { type: Boolean, default: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    conditionType: {
      type: String,
      enum: ['BUY_PRODUCTS', 'BUY_CATEGORY', 'ALL_PRODUCTS'],
      default: 'BUY_PRODUCTS',
    },
    conditionProductIds: { type: [String], default: [] },
    conditionProducts: { type: [PromotionConditionProductSchema], default: [] },
    conditionCategoryIds: { type: [String], default: [] },
    conditionCategories: { type: [PromotionConditionCategorySchema], default: [] },
    minQuantity: { type: Number, default: 1, min: 1 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    giftItems: { type: [PromotionGiftItemSchema], default: [] },
    multiplyGiftByConditionQty: { type: Boolean, default: true },
    itemDiscountType: {
      type: String,
      enum: ['NONE', 'PERCENT', 'AMOUNT'],
      default: 'NONE',
    },
    itemDiscountValue: { type: Number, default: 0, min: 0 },
    billDiscountType: {
      type: String,
      enum: ['NONE', 'PERCENT', 'AMOUNT'],
      default: 'NONE',
    },
    billDiscountValue: { type: Number, default: 0, min: 0 },
    createdBy: { type: String, default: '' },
    createdByName: { type: String, default: '' },
  },
  { timestamps: true }
);

export const PromotionModel = mongoose.model<IPromotion>('Promotion', PromotionSchema);
