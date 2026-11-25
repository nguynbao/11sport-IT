export interface AdminImportRow {
  stt: number;
  /** v5.0: id sản phẩm có sẵn (chọn từ gợi ý / quét / vừa tạo) — server dùng đúng sản phẩm này */
  productId?: string;
  /** Mã gốc do SERVER sinh (sản phẩm có sẵn). Dòng hàng mới để trống — server tự sinh theo Cate+Brand+Version */
  productCode: string;
  /** Mã con của biến thể đã chọn */
  variantCode?: string;
  /** Cho phép thêm Màu/Size mới cho SP đã chọn */
  isNewVariant?: boolean;
  /** Mã màu 2–3 ký tự (tuỳ chọn, server gợi ý nếu trống) */
  colorCode?: string;
  productName: string;
  categoryId: string;
  brand: string;
  color: string;
  colorHexes?: string[];
  size: string;
  unit: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  note: string;
  isConfirmed: boolean;
}

export type SubTab = "PRODUCTS" | "TRANSFER" | "HISTORY" | "REPORT";
export type HistoryView = "IMPORTS" | "MOVEMENTS" | "TRANSFERS";
export type ActiveWarehouseTab = "FLOOR_1" | "FLOOR_2" | "ALL";
export type QuickStockFilter = "ALL" | "IN_STOCK" | "ZERO_STOCK" | "MISSING_PRICE" | "CHANGED";

export const COMMON_COLORS = [
  "Đỏ",
  "Đen",
  "Trắng",
  "Xanh Dương",
  "Xanh Đen",
  "Xanh Lá",
  "Vàng",
  "Hồng",
  "Xám",
  "Tím",
  "Cam",
  "Kem",
];

export const COMMON_SIZES = [
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "FREESIZE",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
];
