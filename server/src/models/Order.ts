import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethod = 'CASH' | 'BANKING' | 'CARD' | 'OTHER';
export type OrderStatus = 'DRAFT' | 'PAID' | 'PARTIALLY_RETURNED' | 'FULLY_RETURNED';
export type DiscountType = 'NONE' | 'PERCENT' | 'AMOUNT' | 'GIFT';
export type DebtStatus = 'NONE' | 'UNPAID' | 'PARTIAL' | 'SETTLED';
export type SplitMethod = 'CASH' | 'BANKING' | 'CARD' | 'DEBT';

export interface ISplitPaymentItem {
  method: SplitMethod;
  amount: number;
}

export interface IDebtPaymentRecord {
  _id?: string;
  amount: number;
  method: 'CASH' | 'BANKING' | 'CARD';
  note?: string;
  paidAt: Date;
  collectedBy: string;
  collectedByName: string;
}

export interface IOrderItem {
  productId: string;
  productCode: string;
  productName: string;
  color?: string;
  size?: string;
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
  splitPayments?: ISplitPaymentItem[];
  hasCardFee: boolean;
  cardFeePercent: number;
  cardFee: number;
  totalAmount: number;
  paidAmount?: number;
  debtAmount?: number;
  initialDebtAmount?: number;
  debtStatus?: DebtStatus;
  debtDueDate?: Date | null;
  debtPayments?: IDebtPaymentRecord[];
  note: string;
  status: OrderStatus;
  createdBy: string;
  createdByName: string;
  confirmedBy?: string;
  confirmedByName?: string;
  confirmedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: String, required: true },
    productCode: { type: String, required: true },
    productName: { type: String, required: true },
    color: { type: String, default: '' },
    size: { type: String, default: '' },
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

const SplitPaymentItemSchema = new Schema<ISplitPaymentItem>(
  {
    method: { type: String, enum: ['CASH', 'BANKING', 'CARD', 'DEBT'], required: true },
    amount: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const DebtPaymentRecordSchema = new Schema<IDebtPaymentRecord>(
  {
    _id: { type: String, default: '' },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['CASH', 'BANKING', 'CARD'], default: 'BANKING' },
    note: { type: String, default: '' },
    paidAt: { type: Date, default: Date.now },
    collectedBy: { type: String, default: '' },
    collectedByName: { type: String, default: '' },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderCode: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, default: '' },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '', index: true },
    items: { type: [OrderItemSchema], default: [] },
    rawSubtotal: { type: Number, default: 0 },
    itemDiscountTotal: { type: Number, default: 0 },
    subtotal: { type: Number, required: true },
    billDiscountType: { type: String, enum: ['NONE', 'PERCENT', 'AMOUNT'], default: 'NONE' },
    billDiscountValue: { type: Number, default: 0 },
    billDiscountAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['CASH', 'BANKING', 'CARD', 'OTHER'], required: true },
    paymentMethodDetail: { type: String, default: '' },
    splitPayments: { type: [SplitPaymentItemSchema], default: [] },
    hasCardFee: { type: Boolean, default: false },
    cardFeePercent: { type: Number, default: 0 },
    cardFee: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    debtAmount: { type: Number, default: 0, index: true },
    initialDebtAmount: { type: Number, default: 0 },
    debtStatus: {
      type: String,
      enum: ['NONE', 'UNPAID', 'PARTIAL', 'SETTLED'],
      default: 'NONE',
      index: true,
    },
    debtDueDate: { type: Date, default: null },
    debtPayments: { type: [DebtPaymentRecordSchema], default: [] },
    note: { type: String, default: 'Giá đã bao gồm thuế' },
    status: {
      type: String,
      enum: ['DRAFT', 'PAID', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'],
      default: 'PAID',
    },
    createdBy: { type: String, default: '' },
    createdByName: { type: String, default: '' },
    confirmedBy: { type: String, default: '' },
    confirmedByName: { type: String, default: '' },
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);
