import mongoose, { Schema, Document } from 'mongoose';
import { PaymentMethod } from './Order';

export type ReturnCondition = 'GOOD' | 'DAMAGED';
export type ReturnType = 'RETURN' | 'EXCHANGE';

export interface IReturnItem {
  productId: string;
  productCode: string;
  productName: string;
  color?: string;
  size?: string;
  unit: string;
  unitPrice: number;
  unitCost?: number;
  quantity: number;
  condition: ReturnCondition;
  restocked: boolean;
  lineTotal: number;
}

export interface IExchangeItem {
  productId: string;
  productCode: string;
  productName: string;
  color?: string;
  size?: string;
  unit: string;
  unitPrice: number;
  unitCost?: number;
  quantity: number;
  lineTotal: number;
}

export interface IReturnExchange extends Document {
  code: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  type: ReturnType;
  returnItems: IReturnItem[];
  exchangeItems: IExchangeItem[];
  returnSubtotal: number;
  refundedCardFee: number;
  returnTotal: number;
  exchangeTotal: number;
  netDifference: number; // > 0: khách trả thêm, < 0: hoàn khách |netDifference|
  refundAmount: number;
  additionalCharge: number;
  debtReduction?: number;
  cashRefund?: number;
  debtBefore?: number;
  debtAfter?: number;
  refundMethod: PaymentMethod;
  note: string;
  performedBy: string;
  performedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnItemSchema = new Schema<IReturnItem>(
  {
    productId: { type: String, required: true },
    productCode: { type: String, required: true },
    productName: { type: String, required: true },
    color: { type: String, default: '' },
    size: { type: String, default: '' },
    unit: { type: String, default: 'Cái' },
    unitPrice: { type: Number, required: true },
    unitCost: { type: Number },
    quantity: { type: Number, required: true },
    condition: { type: String, enum: ['GOOD', 'DAMAGED'], required: true },
    restocked: { type: Boolean, required: true },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

const ExchangeItemSchema = new Schema<IExchangeItem>(
  {
    productId: { type: String, required: true },
    productCode: { type: String, required: true },
    productName: { type: String, required: true },
    color: { type: String, default: '' },
    size: { type: String, default: '' },
    unit: { type: String, default: 'Cái' },
    unitPrice: { type: Number, required: true },
    unitCost: { type: Number },
    quantity: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

const ReturnExchangeSchema = new Schema<IReturnExchange>(
  {
    code: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    orderCode: { type: String, required: true, index: true },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '', index: true },
    type: { type: String, enum: ['RETURN', 'EXCHANGE'], required: true },
    returnItems: { type: [ReturnItemSchema], default: [] },
    exchangeItems: { type: [ExchangeItemSchema], default: [] },
    returnSubtotal: { type: Number, default: 0 },
    refundedCardFee: { type: Number, default: 0 },
    returnTotal: { type: Number, required: true },
    exchangeTotal: { type: Number, required: true },
    netDifference: { type: Number, required: true },
    refundAmount: { type: Number, required: true },
    additionalCharge: { type: Number, required: true },
    debtReduction: { type: Number, default: 0 },
    cashRefund: { type: Number, default: 0 },
    debtBefore: { type: Number, default: 0 },
    debtAfter: { type: Number, default: 0 },
    refundMethod: { type: String, enum: ['CASH', 'BANKING', 'CARD', 'OTHER'], default: 'CASH' },
    note: { type: String, default: '' },
    performedBy: { type: String, default: '' },
    performedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

export const ReturnExchangeModel = mongoose.model<IReturnExchange>('ReturnExchange', ReturnExchangeSchema);
