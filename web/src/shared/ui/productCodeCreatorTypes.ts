import type { Product } from "@/shared/types";

export interface CreatorVariantDraft {
  variantKey?: string;
  color: string;
  colorCode: string;
  size: string;
  sellingPrice: number;
  costPrice: number;
  stockFloor1?: number;
  stockFloor2?: number;
  stock?: number;
}

export interface ProductCodeCreatorResult {
  product: Product;
  /** Biến thể vừa tạo/thêm/sửa (để caller thêm dòng vào phiếu nhập hoặc làm mới danh sách) */
  variants: { color: string; size: string; variantCode?: string; sellingPrice?: number; costPrice?: number }[];
  mode: "CREATED" | "VARIANTS_ADDED" | "UPDATED";
}

export const EMPTY_VARIANT: CreatorVariantDraft = {
  color: "",
  colorCode: "",
  size: "",
  sellingPrice: 0,
  costPrice: 0,
  stockFloor1: 0,
  stockFloor2: 0,
  stock: 0,
};

export const toCode = (v: string, max: number) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);
