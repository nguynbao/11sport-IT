# Nghiệp vụ Danh mục & Quy chuẩn mã (`catalog/`)

Quản lý Danh mục, Thương hiệu, quy tắc sinh/kiểm tra mã sản phẩm v5.0 và công cụ chuyển đổi mã hàng loạt (`recode`).

## Cấu trúc
- `catalogDefaults.service.ts`: khởi tạo brand hệ thống `NN` và gán `skuCode` cho danh mục.
- `category.service.ts`: CRUD danh mục, đồng bộ tên/mã sang sản phẩm liên quan.
- `brand.service.ts`: CRUD thương hiệu, alias và đếm sản phẩm theo hãng.
- `productScheme.service.ts`: phân giải danh mục/thương hiệu/version và đồng bộ biến thể khi recode.
- `recode.service.ts`: lập kế hoạch và thực thi chuyển đổi mã sản phẩm hàng loạt.
