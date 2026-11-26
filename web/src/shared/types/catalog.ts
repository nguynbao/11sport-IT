export interface Category {
  _id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  productCount?: number;
  /** Mã ngắn 1–3 ký tự A-Z0-9 dùng làm CateCode trong mã sản phẩm (v5.0) */
  skuCode?: string;
}

/** Thương hiệu (v5.0 — /brands) */
export interface Brand {
  _id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  aliases?: string[];
  categoryIds?: string[];
  isSystem?: boolean;
  productCount?: number;
}

export type WarehouseFloor = "FLOOR_1" | "FLOOR_2";

export interface ProductVariant {
  variantKey?: string;
  color: string;
  /** Danh sách 1 hoặc nhiều mã màu Hex hiển thị trực quan & viền box */
  colorHexes?: string[];
  size: string;
  /** Mã con riêng theo thuộc tính (Màu, Size): [Mã gốc][MÀU][SIZE] (VD: GASIA221401DO38) */
  variantCode?: string;
  barcode?: string;
  /** Mã màu ngắn 2–3 ký tự trong mã con (v5.0) */
  colorCode?: string;
  /** Giá bán riêng của biến thể (0/trống → dùng giá gốc) */
  sellingPrice?: number;
  /** Giá vốn riêng của biến thể (role SALES không nhận) */
  costPrice?: number;
  /** Giá bán hiệu lực do server tính sẵn */
  effectiveSellingPrice?: number;
  legacyVariantCode?: string;
  legacyVariantCodes?: string[];
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
}

export interface LinkedRetailProductSummary {
  _id: string;
  code: string;
  name: string;
  unit: string;
  packSize: number;
  sellingPrice: number;
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
}

export interface Product {
  _id: string;
  code: string;
  name: string;
  brand?: string;
  brandId?: string;
  brandCode?: string;
  brandName?: string;
  versionName?: string;
  versionCode?: string;
  /** Mã cũ trước chuẩn hoá — chỉ dùng tra cứu/quét tem cũ */
  legacyCode?: string;
  legacyCodes?: string[];
  modelName?: string;
  color?: string;
  colorHexes?: string[];
  size?: string;
  categoryId: string | Category;
  categoryCode?: string;
  categoryName?: string;
  unit: string;
  sellingPrice: number;
  /** Giá gốc (giá nhập gần nhất) — server ẩn với role SALES */
  costPrice?: number;
  barcode?: string;
  variants?: ProductVariant[];
  stockFloor1?: number;
  stockFloor2?: number;
  stock: number;
  /** ID của Sản phẩm Bộ/Hộp/Ống gốc liên kết với sản phẩm lẻ này */
  parentSetProductId?: string;
  /** Số lượng đơn vị lẻ có trong 1 Bộ/Hộp gốc (VD: 12 quả/ống) */
  packSize?: number;
  parentSetProductCode?: string;
  parentSetProductName?: string;
  parentSetUnit?: string;
  parentSetStockFloor1?: number;
  parentSetStockFloor2?: number;
  maxUnpackableFloor1?: number;
  linkedRetailProducts?: LinkedRetailProductSummary[];
  /** Ghi chú sản phẩm */
  note?: string;
}

export interface ImportScanCount {
  userId: string;
  name: string;
  role?: string;
  quantity: number;
}

export interface ImportItem {
  stt: number;
  productCode: string;
  /** Mã con riêng theo thuộc tính (Màu, Size) để in tem & quét kiểm kho */
  variantCode?: string;
  productName: string;
  brand?: string;
  color?: string;
  colorHexes?: string[];
  size?: string;
  categoryId?: string;
  unit: string;
  expectedQuantity: number;
  actualQuantity: number;
  /** Giá gốc (đơn giá nhập, VND) do thủ kho nhập */
  costPrice?: number;
  sellingPrice?: number;
  /** Số chiếc đã quét tag ở bước kiểm thực tế */
  scannedQuantity?: number;
  checkedBy?: string;
  checkedByName?: string;
  checkedByRole?: string;
  checkedAt?: string;
  scanCounts?: ImportScanCount[];
  /** Mã vạch đã học được khi quét tag (= variantCode) */
  barcode?: string;
  note: string;
  isChecked: boolean;
  isConfirmed: boolean;
  discrepancyNote?: string;
}

export interface ImportReceipt {
  _id: string;
  code: string;
  receiptCode?: string;
  status: "DRAFT" | "CHECKING" | "COMPLETED";
  targetWarehouse?: WarehouseFloor;
  note: string;
  defaultCategoryId?: string;
  items: ImportItem[];
  createdBy?: string | { fullName?: string; username?: string };
  createdByName?: string;
  createdByRole?: string;
  completedBy?: string;
  completedByName?: string;
  completedByRole?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PreviewCodeVariant {
  color: string;
  colorCode?: string;
  size: string;
  sizeCode?: string;
  variantCode?: string;
}

export interface PreviewCodeResult {
  categoryCode: string;
  brandCode: string;
  versionCode: string;
  suggestedVersionCode: string;
  code: string;
  variants: PreviewCodeVariant[];
  duplicate: { _id: string; code: string; name: string; versionName?: string } | null;
  conflicts: { type: string; code: string; productId: string; productCode: string }[];
}

export interface ProductLookupResult {
  product: Product;
  variant: ProductVariant | null;
  matchedBy: "CODE" | "VARIANT_CODE" | "LEGACY_CODE" | "LEGACY_VARIANT_CODE" | "COMPACT_BARCODE";
  sellingPrice: number;
}
