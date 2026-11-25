# Nghiệp vụ Sản phẩm (`products/`)

Quản lý danh sách sản phẩm, tạo/cập nhật sản phẩm theo mã quy chuẩn v5.0, biến thể (màu/size) và sinh mã vạch.

## Cấu trúc
- `product.rules.ts`: kiểm tra quyền sửa giá (giá bán/giá gốc), ẩn giá vốn với Sales.
- `productVariant.service.ts`: thêm và cập nhật biến thể sản phẩm.
- `product.service.ts`: CRUD, tra cứu nhanh (`lookup`) và sinh/xem trước mã sản phẩm.
