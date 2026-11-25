/**
 * Tiện ích tối ưu hóa ảnh Cloudinary trên Storefront FE (11 Sport)
 * Tự động chèn các transformation: f_auto, q_auto, resize theo kích thước hiển thị.
 */

export interface CloudinaryTransformOptions {
  width?: number;
  height?: number;
  quality?: "auto" | "auto:best" | "auto:good" | "auto:eco" | "auto:low" | number;
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
  crop?: "fill" | "fit" | "limit" | "scale" | "thumb";
}

/**
 * Biến đổi URL Cloudinary nguyên bản thành URL đã qua tối ưu hóa CDN
 * Ví dụ: https://res.cloudinary.com/demo/image/upload/sample.jpg
 * => https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800,c_limit/sample.jpg
 */
export function getOptimizedCloudinaryUrl(
  url: string | null | undefined,
  options?: CloudinaryTransformOptions
): string {
  const raw = String(url || "").trim();
  if (!raw || !raw.includes("res.cloudinary.com") || !raw.includes("/image/upload/")) {
    return raw;
  }

  // Tránh chèn lặp lại nếu URL đã chứa biến đổi
  if (/\/image\/upload\/(f_|w_|h_|q_|c_)/.test(raw)) {
    return raw;
  }

  const {
    width,
    height,
    quality = "auto",
    format = "auto",
    crop = width && height ? "fill" : "limit",
  } = options || {};

  const parts: string[] = [];
  if (format) parts.push(`f_${format}`);
  if (quality) parts.push(`q_${quality}`);
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if ((width || height) && crop) parts.push(`c_${crop}`);

  if (parts.length === 0) return raw;

  const transformString = parts.join(",");
  return raw.replace("/image/upload/", `/image/upload/${transformString}/`);
}
