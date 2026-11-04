import mongoose, { Schema, Document } from 'mongoose';

export type WarehouseFloor = 'FLOOR_1' | 'FLOOR_2';

export interface IProductVariant {
  variantKey: string;
  /** Mã con (Child SKU) riêng cho từng biến thể Màu + Size (VD: GASIA221401DO38) */
  variantCode?: string;
  /** Mã vạch Code128 in trên tem nhãn của biến thể này (= variantCode) */
  barcode?: string;
  color: string;
  /** Danh sách 1 hoặc nhiều mã màu Hex hiển thị trực quan & làm viền box (VD: ["#FFFFFF", "#18181B"]) */
  colorHexes?: string[];
  size: string;
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
}

export interface IProduct extends Document {
  code: string;
  name: string;
  brand?: string;
  modelName?: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  unit: string;
  sellingPrice: number;
  /** Giá gốc (giá nhập gần nhất) — cập nhật khi hoàn thành phiếu nhập kho */
  costPrice: number;
  /** Mã vạch Code128 in trên tem nhãn Label (= Mã sản phẩm gốc code) */
  barcode?: string;
  /** Danh sách biến thể theo Màu sắc & Size bên trong cùng 1 Mã sản phẩm */
  variants?: IProductVariant[];
  /** Tồn Kho Tầng 1 (tổng các biến thể) */
  stockFloor1?: number;
  /** Tồn Kho Tầng 2 (tổng các biến thể) */
  stockFloor2?: number;
  /** Tổng tồn kho (= stockFloor1 + stockFloor2) */
  stock: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    variantKey: { type: String, required: true, default: 'DEFAULT' },
    variantCode: { type: String, default: '', trim: true, uppercase: true },
    barcode: { type: String, default: '', trim: true, uppercase: true },
    color: { type: String, default: '', trim: true },
    colorHexes: { type: [String], default: [] },
    size: { type: String, default: '', trim: true },
    stockFloor1: { type: Number, default: 0, min: 0 },
    stockFloor2: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: '', trim: true },
    modelName: { type: String, default: '', trim: true },
    categoryId: { type: String, required: true, index: true },
    categoryCode: { type: String, default: '' },
    categoryName: { type: String, default: '' },
    unit: { type: String, required: true, default: 'Cái', trim: true },
    sellingPrice: { type: Number, required: true, default: 0, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    barcode: { type: String, default: '', trim: true },
    variants: { type: [ProductVariantSchema], default: [] },
    stockFloor1: { type: Number, default: 0 },
    stockFloor2: { type: Number, default: 0 },
    stock: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
