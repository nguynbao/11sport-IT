import mongoose, { Schema, Document } from 'mongoose';

export type StockMovementType =
  | 'IMPORT'
  | 'SALE'
  | 'RETURN'
  | 'EXCHANGE_IN'
  | 'EXCHANGE_OUT'
  | 'ADJUSTMENT'
  | 'TRANSFER';

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
  /** Kho liên quan (FLOOR_1 | FLOOR_2) */
  warehouseLocation?: 'FLOOR_1' | 'FLOOR_2';
  /** Kho nguồn khi xuất chuyển tầng (TRANSFER) */
  fromWarehouse?: 'FLOOR_1' | 'FLOOR_2';
  /** Kho đích khi xuất chuyển tầng (TRANSFER) */
  toWarehouse?: 'FLOOR_1' | 'FLOOR_2';
  referenceType: 'IMPORT_RECEIPT' | 'ORDER' | 'RETURN_EXCHANGE' | 'ADJUSTMENT' | 'TRANSFER';
  referenceId: string;
  referenceCode: string;
  performedBy: string;
  performedByName: string;
  performedByRole?: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    type: {
      type: String,
      enum: ['IMPORT', 'SALE', 'RETURN', 'EXCHANGE_IN', 'EXCHANGE_OUT', 'ADJUSTMENT', 'TRANSFER'],
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
    warehouseLocation: { type: String, default: 'FLOOR_1' },
    fromWarehouse: { type: String, default: '' },
    toWarehouse: { type: String, default: '' },
    referenceType: {
      type: String,
      enum: ['IMPORT_RECEIPT', 'ORDER', 'RETURN_EXCHANGE', 'ADJUSTMENT', 'TRANSFER'],
      required: true,
    },
    referenceId: { type: String, default: '' },
    referenceCode: { type: String, required: true },
    performedBy: { type: String, default: 'SYSTEM' },
    performedByName: { type: String, default: 'Hệ thống' },
    performedByRole: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

export const StockMovementModel = mongoose.model<IStockMovement>('StockMovement', StockMovementSchema);
