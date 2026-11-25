export type CurrencyCode = "VND" | "PHP" | "USD";
export type LocaleCode = "vi" | "en";

export const VND_PER_USD = 25_000;
export const VND_PER_PHP = 440;

/**
 * Format số tiền sang định dạng chuẩn Việt Nam: 1.030.000₫
 */
export function formatVND(amount: number | null | undefined): string {
  const safeValue =
    typeof amount === "number" && Number.isFinite(amount)
      ? Math.max(0, Math.round(amount))
      : 0;
  const formatted = new Intl.NumberFormat("vi-VN").format(safeValue);
  return `${formatted}₫`;
}

export function convertFromVnd(
  amountVnd: number,
  currency: CurrencyCode = "VND"
): number {
  if (currency === "VND") return Math.round(amountVnd);
  if (currency === "PHP") {
    return Math.round((amountVnd / VND_PER_PHP) * 100) / 100;
  }
  return Math.round((amountVnd / VND_PER_USD) * 100) / 100;
}

export function formatPriceByCurrency(
  amountVnd: number | null | undefined,
  currency: CurrencyCode = "VND"
): string {
  const safe =
    typeof amountVnd === "number" && Number.isFinite(amountVnd)
      ? Math.max(0, amountVnd)
      : 0;
  if (currency === "USD") {
    const usd = convertFromVnd(safe, "USD");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: usd % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(usd);
  }
  if (currency === "PHP") {
    const php = convertFromVnd(safe, "PHP");
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(php));
    return `₱${formatted}`;
  }
  return formatVND(safe);
}

/**
 * Tính phần trăm giảm giá (làm tròn gần nhất, trả về 0 nếu không giảm).
 */
export function calcDiscountPercent(
  price: number,
  compareAtPrice?: number | null
): number {
  if (!compareAtPrice || compareAtPrice <= price || compareAtPrice <= 0) {
    return 0;
  }
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

/**
 * Bỏ dấu tiếng Việt và chuẩn hóa chữ thường để tìm kiếm / tạo slug.
 */
export function stripVietnameseDiacritics(input: string | null | undefined): string {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyVi(input: string | null | undefined): string {
  return stripVietnameseDiacritics(input)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Chuẩn hóa số điện thoại Việt Nam về dạng 10-11 chữ số liền (0901234567).
 */
export function normalizePhoneVN(input: string | null | undefined): string {
  const raw = String(input || "").replace(/[\s.\-()]/g, "");
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+84") || (digits.startsWith("84") && digits.length >= 11)) {
    digits = `0${digits.slice(2)}`;
  }
  return digits.slice(0, 11);
}

/**
 * Format số điện thoại Việt Nam khi nhập/hiển thị: 0901 234 567
 */
export function formatPhoneVN(input: string | null | undefined): string {
  const digits = normalizePhoneVN(input);
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

/**
 * Kiểm tra hợp lệ số điện thoại Việt Nam (10-11 chữ số bắt đầu bằng 0).
 */
export function isValidPhoneVN(input: string | null | undefined): boolean {
  const digits = normalizePhoneVN(input);
  return /^0[0-9]{9,10}$/.test(digits);
}

import { CloudinaryTransformOptions, getOptimizedCloudinaryUrl } from "./cloudinary";

/**
 * Chuẩn hóa URL ảnh từ Backend (hỗ trợ Cloudinary https://..., /uploads/..., và ảnh mock nội bộ /images/mock/...).
 * Tùy chọn truyền options để tự động tối ưu hóa kích thước Cloudinary qua CDN.
 */
export function resolveMediaUrl(
  url: string | null | undefined,
  fallback = "",
  options?: CloudinaryTransformOptions
): string {
  const raw = String(url || "").trim();
  if (!raw) return fallback;
  if (raw.startsWith("/images/mock/")) return raw;
  if (raw.startsWith("/images/")) return fallback;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) {
    if (raw.includes("res.cloudinary.com") && options) {
      return getOptimizedCloudinaryUrl(raw, options);
    }
    return raw;
  }
  if (raw.startsWith("/uploads/")) {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
    const origin = apiBase.replace(/\/api\/v1\/?$/, "");
    return `${origin}${raw}`;
  }
  return raw;
}
