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
  /** v5.0: ColorCode 2–3 ký tự trong mã con (Mã gốc + ColorCode + SizeCode) */
  colorCode?: string;
  /** v5.0: Giá bán riêng của biến thể (0/trống = dùng giá gốc) */
  sellingPrice?: number;
  /** v5.0: Giá vốn riêng của biến thể (0/trống = dùng giá gốc) */
  costPrice?: number;
  /** v5.0: Mã con cũ trước chuẩn hoá (tra cứu/quét tem cũ) */
  legacyVariantCode?: string;
  legacyVariantCodes?: string[];
  /** v6.0: Ảnh riêng của biến thể (swatch màu trên storefront) */
  imageUrl?: string;
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
}

export interface IProductImage {
  url: string;
  alt?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}

export interface IProductSpec {
  label: string;
  value: string;
}

export interface ISeoMeta {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
}

export interface IProduct extends Document {
  code: string;
  name: string;
  brand?: string;
  modelName?: string;
  /** v5.0: Thương hiệu chuẩn hoá */
  brandId?: string;
  brandCode?: string;
  brandName?: string;
  /** v5.0: Version = tên mẫu (R5) */
  versionName?: string;
  versionCode?: string;
  /** v5.0: Mã gốc cũ trước chuẩn hoá */
  legacyCode?: string;
  legacyCodes?: string[];
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
  /** ID của Sản phẩm Bộ/Hộp/Ống gốc liên kết với sản phẩm lẻ này (nếu có) */
  parentSetProductId?: string;
  /** Số lượng đơn vị lẻ có trong 1 Bộ/Hộp gốc (VD: 12 quả/ống, 60 cái/hộp) */
  packSize?: number;
  /** Ghi chú sản phẩm */
  note?: string;
  /** v6.0: Thông tin hiển thị Storefront & SEO */
  slug?: string;
  isPublishedOnline?: boolean;
  isFeatured?: boolean;
  compareAtPrice?: number;
  images?: IProductImage[];
  shortDescription?: string;
  descriptionHtml?: string;
  specs?: IProductSpec[];
  seo?: ISeoMeta;
  ratingAvg?: number;
  ratingCount?: number;
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
    colorCode: { type: String, trim: true, uppercase: true },
    sellingPrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },
    legacyVariantCode: { type: String, trim: true, uppercase: true },
    legacyVariantCodes: { type: [String], default: undefined },
    imageUrl: { type: String, default: '', trim: true },
    stockFloor1: { type: Number, default: 0, min: 0 },
    stockFloor2: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ProductImageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, default: '', trim: true },
    isPrimary: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const ProductSpecSchema = new Schema<IProductSpec>(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const SeoMetaSchema = new Schema<ISeoMeta>(
  {
    title: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    canonical: { type: String, default: '', trim: true },
    ogImage: { type: String, default: '', trim: true },
    noIndex: { type: Boolean, default: false },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: '', trim: true },
    modelName: { type: String, default: '', trim: true },
    brandId: { type: String, trim: true, index: true },
    brandCode: { type: String, trim: true, uppercase: true },
    brandName: { type: String, trim: true },
    versionName: { type: String, trim: true },
    versionCode: { type: String, trim: true, uppercase: true },
    legacyCode: { type: String, trim: true, uppercase: true, index: true },
    legacyCodes: { type: [String], default: undefined },
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
    parentSetProductId: { type: String, default: '', trim: true },
    packSize: { type: Number, default: 0, min: 0 },
    note: { type: String, default: '', trim: true },
    slug: { type: String, trim: true, lowercase: true },
    isPublishedOnline: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    compareAtPrice: { type: Number, min: 0 },
    images: { type: [ProductImageSchema], default: [] },
    shortDescription: { type: String, default: '', trim: true },
    descriptionHtml: { type: String, default: '' },
    specs: { type: [ProductSpecSchema], default: [] },
    seo: { type: SeoMetaSchema, default: undefined },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

// R4: (Category, Brand, Version) duy nhất cho sản phẩm theo quy chuẩn mới
ProductSchema.index(
  { categoryId: 1, brandId: 1, versionCode: 1 },
  { unique: true, partialFilterExpression: { versionCode: { $type: 'string' } } }
);
ProductSchema.index({ slug: 1 }, { unique: true, sparse: true });
ProductSchema.index({ isPublishedOnline: 1, status: 1, isFeatured: -1, createdAt: -1 });
ProductSchema.index({ isPublishedOnline: 1, categoryId: 1, status: 1 });
ProductSchema.index({ isPublishedOnline: 1, brandId: 1, status: 1 });

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
