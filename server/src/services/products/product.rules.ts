import { ApiError } from "../../shared/errors";
import { resolveVariantPricing } from "../../shared/productCode";
import { getFloorStocks } from "../inventory";

export const isPriceManager = (role?: string) => role === "CEO" || role === "ADMIN" || role === "ACCOUNTANT";
export const canEditSellingPrice = (role?: string) => role === 'CEO' || role === 'ADMIN' || role === 'ACCOUNTANT';

export function inferActorRole(
  explicitRole?: string,
  userId?: string,
  userName?: string,
  staffRoleMap?: Map<string, string>,
  fallback = 'ADMIN'
): string {
  const cleanRole = String(explicitRole || '').trim().toUpperCase();
  if (cleanRole === 'CEO' || cleanRole === 'ADMIN' || cleanRole === 'ACCOUNTANT' || cleanRole === 'HR' || cleanRole === 'MARKETING' || cleanRole === 'SALES') {
    return cleanRole;
  }
  const uid = String(userId || '').trim();
  if (uid && staffRoleMap?.has(uid)) {
    return staffRoleMap.get(uid)!;
  }
  const upperId = uid.toUpperCase();
  if (upperId === 'ADMIN') return 'ADMIN';
  if (upperId === 'ACCOUNTANT') return 'ACCOUNTANT';
  if (upperId === 'SALES') return 'SALES';
  const nameLower = String(userName || '').toLowerCase();
  if (nameLower.includes('admin') || nameLower.includes('quản trị') || nameLower.includes('quản lý')) {
    return 'ADMIN';
  }
  if (nameLower.includes('kế toán') || nameLower.includes('thủ kho') || nameLower.includes('kho')) {
    return 'ACCOUNTANT';
  }
  return fallback;
}


// POST /api/v1/products/generate-code

/** Ẩn giá vốn (gốc + biến thể) với role SALES, bổ sung giá hiệu lực của biến thể */
export function presentVariants(product: any, variants: any[], hideCost: boolean) {
  const baseSelling = Math.max(0, Math.round(Number(product?.sellingPrice) || 0));
  return variants.map((v: any) => {
    const { costPrice, ...rest } = v || {};
    const vSelling = Math.round(Number(v?.sellingPrice) || 0);
    return {
      ...rest,
      ...(hideCost ? {} : costPrice !== undefined ? { costPrice } : {}),
      effectiveSellingPrice: vSelling > 0 ? vSelling : baseSelling,
    };
  });
}

// POST /api/v1/products/preview-code (v5.0) — xem trước mã theo Category + Brand + Version (không ghi DB)

// GET /api/v1/products/lookup?code= (v5.0) — tra cứu theo mã quét (mã mới, mã con, mã cũ)

// GET /api/v1/products

// POST /api/v1/products

export function parseMoneyField(raw: any, field: string, code: string, label: string): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const v = Math.round(Number(raw));
  if (isNaN(v) || v < 0) {
    throw new ApiError(400, code, `${label} phải là số nguyên không âm`, { [field]: 'Không hợp lệ' });
  }
  return v;
}

/** Kiểm tra quyền đặt giá (gốc + biến thể) giống luồng cũ */
export function assertPricePermission(role: string | undefined, selling: number[], cost: number[]) {
  if (selling.some((p) => p > 0) && !isPriceManager(role)) {
    throw new ApiError(403, 'SELLING_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin mới được đặt giá bán');
  }
  if (cost.some((c) => c > 0) && !isPriceManager(role)) {
    throw new ApiError(403, 'COST_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin mới được đặt giá gốc');
  }
}

/** v5.0: tạo sản phẩm theo quy chuẩn mã mới (R1–R4, R8–R10) */
