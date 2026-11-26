# Nghiệp vụ Khuyến mãi (`promotions/`)

Quản lý chương trình khuyến mãi (giảm % / tiền / tặng sản phẩm, điều kiện theo đơn hoặc danh mục/sản phẩm) và đánh giá áp dụng khuyến mãi cho giỏ hàng.

## Cấu trúc
- `promotion.rules.ts`: kiểm tra quyền ADMIN, chuẩn hóa ngày hiệu lực và tính trạng thái hiệu lực thực tế của chương trình.
- `promotion.service.ts`: CRUD chương trình khuyến mãi và `evaluatePromotions` cho POS/đơn hàng.
