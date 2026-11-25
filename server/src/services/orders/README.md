# Nghiệp vụ Bán hàng, Khách hàng & Công nợ (`orders/`)

Quản lý đơn bán tại quầy (trực tiếp hoặc bản nháp `DRAFT`), tra cứu/cập nhật khách hàng và thu nợ theo lịch sử công nợ.

## Cấu trúc
- `orderShift.rules.ts`: hàm thuần xác định ca làm việc của đơn và giới hạn 3 ngày xem bill của Sales.
- `customer.service.ts`: tra cứu nhanh khách hàng theo SĐT và danh sách khách hàng.
- `debtPayment.service.ts`: thu công nợ đơn hàng (khóa tuần tự theo `orderId`).
- `order.service.ts`: tạo đơn, lưu/sửa/xóa/chốt bản nháp, tự động tách sản phẩm Bộ sang Lẻ khi thiếu hàng tại Tầng 1.
