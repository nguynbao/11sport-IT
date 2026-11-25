# Nghiệp vụ Bàn giao ca (`handover/`)

Quản lý kiểm kho đầu/cuối ca tại Kho Tầng 1 và bàn giao tiền mặt giữa các ca bán hàng.

## Quy tắc chính
- Danh mục kiểm hàng mỗi ngày luôn gồm **Vợt** (`isRacketCategory`) cộng thêm danh mục cấu hình theo Thứ (hoặc xoay vòng deterministic nếu chưa cấu hình).
- Phiếu bàn giao `PENDING` quá hạn (> 1 ngày hoặc bị thay bởi ca mới) tự động chuyển `STORE_CLOSED` và chốt giờ check-out chấm công (`pendingCheckOutTime`) cho người giao ca.
- Ca nhận xác nhận phiếu (`confirmHandover`) sẽ chốt check-out thực tế của người giao ca trước đó theo đúng mốc giờ gửi.

## Cấu trúc
- `handover.rules.ts`: hàm thuần phân quyền, nhận diện danh mục vợt, lọc phiếu chờ đến ca nhận.
- `handover.queries.ts`: tính danh sách sản phẩm kiểm kê theo ngày (`computeDailyHandoverCheck`).
- `handover.service.ts`: luồng lập nháp/gửi phiếu, xác nhận, xóa và xử lý hết hạn.
