# Nghiệp vụ Dịch vụ Kỹ thuật (`service-orders/`)

Quản lý danh mục dịch vụ (căng vợt, hàn vợt...) và đơn dịch vụ theo vòng đời `RECEIVED` → `IN_PROGRESS` → `READY` → `RETURNED` (hoặc `CANCELLED`) kèm thu tiền, giảm giá và phí quẹt thẻ.

## Cấu trúc
- `serviceOrder.rules.ts`: phân quyền theo vai trò, chuẩn hóa mã loại dịch vụ, làm giàu dữ liệu đơn và tính trạng thái thanh toán.
- `serviceType.service.ts`: quản lý danh mục loại dịch vụ (`listServiceTypes`, `createServiceType`, `updateServiceType`, `deleteServiceType`).
- `serviceOrder.service.ts`: tạo/sửa đơn dịch vụ, chuyển trạng thái xử lý và ghi nhận thanh toán.
