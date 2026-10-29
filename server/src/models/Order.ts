import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethod = 'CASH' | 'BANKING' | 'CARD';
export type OrderStatus = 'PAID' | 'PARTIALLY_RETURNED' | 'FULLY_RETURNED';

export interface IOrderItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
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
  subtotal: number;
  paymentMethod: PaymentMethod;
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
    subtotal: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['CASH', 'BANKING', 'CARD'], required: true },
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
