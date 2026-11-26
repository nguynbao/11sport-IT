/** Thông điệp tiếng Việt cho các mã lỗi mới v5.0 (fallback message server). */
const PRODUCT_CODE_ERROR_MESSAGES: Record<string, string> = {
  PRODUCT_DUPLICATE: "Sản phẩm cùng Danh mục + Thương hiệu + Version đã tồn tại.",
  CODE_CONFLICT: "Mã sinh ra trùng với mã của sản phẩm khác — hãy sửa Version code hoặc mã màu.",
  BRAND_HAS_PRODUCTS: "Thương hiệu đang có sản phẩm, không thể xoá — chỉ được ngừng sử dụng.",
  BRAND_NOT_IN_CATEGORY: "Thương hiệu không thuộc danh mục đã chọn.",
  BRAND_NOT_FOUND: "Không tìm thấy thương hiệu.",
  BRAND_INACTIVE: "Thương hiệu đã ngừng sử dụng.",
  BRAND_CODE_IMMUTABLE: "Thương hiệu đã có sản phẩm, không được đổi mã.",
  BRAND_SYSTEM_LOCKED: "Không được sửa mã/trạng thái/danh mục hoặc xoá thương hiệu hệ thống NN.",
  BRAND_CATEGORY_IN_USE: "Không thể bỏ danh mục đang có sản phẩm của thương hiệu này.",
  INVALID_BRAND_CODE: "Mã thương hiệu phải gồm 2–4 ký tự A-Z, 0-9.",
  DUPLICATE_BRAND_CODE: "Mã thương hiệu đã tồn tại.",
  DUPLICATE_BRAND_NAME: "Tên thương hiệu đã tồn tại.",
  INVALID_VERSION_CODE: "Version code phải gồm 1–6 ký tự A-Z, 0-9 và không trùng định dạng mã cũ.",
  INVALID_COLOR_CODE: "Mã màu phải gồm 2–3 ký tự A-Z, 0-9.",
  COLOR_CODE_DUPLICATE: "Hai màu khác nhau không được dùng cùng mã màu (1 màu ↔ 1 mã).",
  DUPLICATE_VARIANT: "Biến thể (Màu + Size) đã tồn tại trong sản phẩm.",
  VARIANT_NOT_FOUND: "Không tìm thấy biến thể.",
  INVALID_SKU_CODE: "Mã Cate phải gồm 1–3 ký tự A-Z, 0-9.",
  DUPLICATE_SKU_CODE: "Mã Cate đã được danh mục khác sử dụng.",
  CATEGORY_SKU_CODE_IMMUTABLE: "Danh mục đã có sản phẩm, không được đổi mã Cate.",
  PRODUCT_CODE_IMMUTABLE: "Không được đổi Thương hiệu/Version code/Danh mục của sản phẩm đã sinh mã.",
};

export function describeApiError(err: any, fallback = "Đã có lỗi xảy ra."): string {
  const code = String(err?.code || "");
  const serverMsg = String(err?.message || "").trim();
  if (serverMsg && !/^Lỗi hệ thống \(/.test(serverMsg)) return serverMsg;
  return PRODUCT_CODE_ERROR_MESSAGES[code] || serverMsg || fallback;
}
