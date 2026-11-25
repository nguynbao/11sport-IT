# Feature Danh mục & Sản phẩm (`catalog/`)

Quản lý Danh mục, Thương hiệu (Brand) và Danh mục Sản phẩm chuẩn mã v5.0.

## Cấu trúc
- `api.ts`: Re-export API tra cứu/tạo mã sản phẩm từ `@/shared/api/catalogLookup`.
- `exports.ts`: Xuất Excel danh mục và thương hiệu.
- `components/`: `CategoryBrandModule.tsx` (tổng hợp 3 tab), `CategoryModule.tsx`, `BrandModule.tsx`, `ProductCatalogModule.tsx`.
