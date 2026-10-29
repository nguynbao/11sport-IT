import mongoose, { Schema, Document } from 'mongoose';
import { PaymentMethod } from './Order';

export type ReturnCondition = 'GOOD' | 'DAMAGED';
export type ReturnType = 'RETURN' | 'EXCHANGE';

export interface IReturnItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  condition: ReturnCondition;
  restocked: boolean;
  lineTotal: number;
}

export interface IExchangeItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  unitPrice: number;
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
  returnTotal: number;
  exchangeTotal: number;
  netDifference: number; // > 0: khách trả thêm, < 0: hoàn khách |netDifference|
  refundAmount: number;
  additionalCharge: number;
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
    unit: { type: String, default: 'Cái' },
    unitPrice: { type: Number, required: true },
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
    unit: { type: String, default: 'Cái' },
    unitPrice: { type: Number, required: true },
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
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true, index: true },
    type: { type: String, enum: ['RETURN', 'EXCHANGE'], required: true },
    returnItems: { type: [ReturnItemSchema], default: [] },
    exchangeItems: { type: [ExchangeItemSchema], default: [] },
    returnTotal: { type: Number, required: true },
    exchangeTotal: { type: Number, required: true },
    netDifference: { type: Number, required: true },
    refundAmount: { type: Number, required: true },
    additionalCharge: { type: Number, required: true },
    refundMethod: { type: String, enum: ['CASH', 'BANKING', 'CARD'], default: 'CASH' },
    note: { type: String, default: '' },
    performedBy: { type: String, default: '' },
    performedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

export const ReturnExchangeModel = mongoose.model<IReturnExchange>('ReturnExchange', ReturnExchangeSchema);
