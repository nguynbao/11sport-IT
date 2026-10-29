import mongoose, { Schema, Document } from 'mongoose';

export type ImportReceiptStatus = 'DRAFT' | 'CHECKING' | 'COMPLETED';

export interface IImportReceiptItem {
  stt: number;
  productId?: string;
  productCode: string;
  productName: string;
  categoryId: string;
  unit: string;
  expectedQuantity: number;
  actualQuantity: number;
  /** Giá gốc (đơn giá nhập, VND) do thủ kho nhập */
  costPrice: number;
  /** Số chiếc đã quét tag ở bước kiểm thực tế */
  scannedQuantity: number;
  note: string;
  isChecked: boolean;
  isConfirmed: boolean;
  discrepancyNote: string;
}

export interface IImportReceipt extends Document {
  code: string;
  status: ImportReceiptStatus;
  defaultCategoryId: string;
  note: string;
  items: IImportReceiptItem[];
  createdBy: string;
  createdByName: string;
  completedBy?: string;
  completedByName?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ImportReceiptItemSchema = new Schema<IImportReceiptItem>(
  {
    stt: { type: Number, required: true },
    productId: { type: String, default: '' },
    productCode: { type: String, required: true },
    productName: { type: String, required: true },
    categoryId: { type: String, default: '' },
    unit: { type: String, default: 'Cái' },
    expectedQuantity: { type: Number, required: true, default: 0 },
    actualQuantity: { type: Number, required: true, default: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    scannedQuantity: { type: Number, default: 0, min: 0 },
    note: { type: String, default: '' },
    isChecked: { type: Boolean, default: false },
    isConfirmed: { type: Boolean, default: false },
    discrepancyNote: { type: String, default: '' },
  },
  { _id: false }
);

const ImportReceiptSchema = new Schema<IImportReceipt>(
  {
    code: { type: String, required: true, unique: true },
    status: { type: String, enum: ['DRAFT', 'CHECKING', 'COMPLETED'], default: 'DRAFT' },
    defaultCategoryId: { type: String, default: '' },
    note: { type: String, default: '' },
    items: { type: [ImportReceiptItemSchema], default: [] },
    createdBy: { type: String, default: '' },
    createdByName: { type: String, default: '' },
    completedBy: { type: String, default: '' },
    completedByName: { type: String, default: '' },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export const ImportReceiptModel = mongoose.model<IImportReceipt>('ImportReceipt', ImportReceiptSchema);
