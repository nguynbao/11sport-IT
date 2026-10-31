import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethod = 'CASH' | 'BANKING' | 'CARD' | 'OTHER';
export type OrderStatus = 'PAID' | 'PARTIALLY_RETURNED' | 'FULLY_RETURNED';
export type DiscountType = 'NONE' | 'PERCENT' | 'AMOUNT' | 'GIFT';

export interface IOrderItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  originalUnitPrice?: number;
  isGift?: boolean;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
  unitPrice: number;
  quantity: number;
  returnedQuantity: number;
  lineTotal: number;
}

export interface IOrder extends Document {
  orderCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: IOrderItem[];
  rawSubtotal?: number;
  itemDiscountTotal?: number;
  subtotal: number;
  billDiscountType?: DiscountType;
  billDiscountValue?: number;
  billDiscountAmount?: number;
  paymentMethod: PaymentMethod;
  paymentMethodDetail?: string;
  hasCardFee: boolean;
  cardFeePercent: number;
  cardFee: number;
  totalAmount: number;
  note: string;
  status: OrderStatus;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: String, required: true },
    productCode: { type: String, required: true },
    productName: { type: String, required: true },
    unit: { type: String, default: 'Cái' },
    originalUnitPrice: { type: Number, default: 0 },
    isGift: { type: Boolean, default: false },
    discountType: { type: String, enum: ['NONE', 'PERCENT', 'AMOUNT', 'GIFT'], default: 'NONE' },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true },
    returnedQuantity: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderCode: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, default: '' },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true, index: true },
    items: { type: [OrderItemSchema], default: [] },
    rawSubtotal: { type: Number, default: 0 },
    itemDiscountTotal: { type: Number, default: 0 },
    subtotal: { type: Number, required: true },
    billDiscountType: { type: String, enum: ['NONE', 'PERCENT', 'AMOUNT'], default: 'NONE' },
    billDiscountValue: { type: Number, default: 0 },
    billDiscountAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['CASH', 'BANKING', 'CARD', 'OTHER'], required: true },
    paymentMethodDetail: { type: String, default: '' },
    hasCardFee: { type: Boolean, default: false },
    cardFeePercent: { type: Number, default: 0 },
    cardFee: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    note: { type: String, default: 'Giá đã bao gồm thuế' },
    status: {
      type: String,
      enum: ['PAID', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'],
      default: 'PAID',
    },
    createdBy: { type: String, default: '' },
    createdByName: { type: String, default: '' },
  },
  { timestamps: true }
);

export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);
