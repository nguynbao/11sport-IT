import mongoose, { Schema, Document } from 'mongoose';

export type StockMovementType =
  | 'IMPORT'
  | 'SALE'
  | 'RETURN'
  | 'EXCHANGE_IN'
  | 'EXCHANGE_OUT'
  | 'ADJUSTMENT';

export interface IStockMovement extends Document {
  type: StockMovementType;
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  unit: string;
  quantityChange: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: 'IMPORT_RECEIPT' | 'ORDER' | 'RETURN_EXCHANGE' | 'ADJUSTMENT';
  referenceId: string;
  referenceCode: string;
  performedBy: string;
  performedByName: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    type: {
      type: String,
      enum: ['IMPORT', 'SALE', 'RETURN', 'EXCHANGE_IN', 'EXCHANGE_OUT', 'ADJUSTMENT'],
      required: true,
      index: true,
    },
    productId: { type: String, required: true, index: true },
    productCode: { type: String, required: true },
    productName: { type: String, required: true },
    categoryId: { type: String, default: '' },
    unit: { type: String, default: 'Cái' },
    quantityChange: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    referenceType: {
      type: String,
      enum: ['IMPORT_RECEIPT', 'ORDER', 'RETURN_EXCHANGE', 'ADJUSTMENT'],
      required: true,
    },
    referenceId: { type: String, default: '' },
    referenceCode: { type: String, required: true },
    performedBy: { type: String, default: 'SYSTEM' },
    performedByName: { type: String, default: 'Hệ thống' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

export const StockMovementModel = mongoose.model<IStockMovement>('StockMovement', StockMovementSchema);
