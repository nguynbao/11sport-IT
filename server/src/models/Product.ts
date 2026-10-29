import mongoose, { Schema, Document } from 'mongoose';

export type WarehouseFloor = 'FLOOR_1' | 'FLOOR_2';

export interface IProduct extends Document {
  code: string;
  name: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  unit: string;
  sellingPrice: number;
  /** Giá gốc (giá nhập gần nhất) — cập nhật khi hoàn thành phiếu nhập kho */
  costPrice: number;
  /** Mã vạch EAN/Code128 in trên tag sản phẩm */
  barcode?: string;
  /** Tồn Kho Tầng 1 */
  stockFloor1?: number;
  /** Tồn Kho Tầng 2 */
  stockFloor2?: number;
  /** Tổng tồn kho (= stockFloor1 + stockFloor2) */
  stock: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    categoryId: { type: String, required: true, index: true },
    categoryCode: { type: String, default: '' },
    categoryName: { type: String, default: '' },
    unit: { type: String, required: true, default: 'Cái', trim: true },
    sellingPrice: { type: Number, required: true, default: 0, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    barcode: { type: String, default: '', trim: true },
    stockFloor1: { type: Number, default: 0 },
    stockFloor2: { type: Number, default: 0 },
    stock: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
