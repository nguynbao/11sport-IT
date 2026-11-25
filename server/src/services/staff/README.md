# Nghiệp vụ Nhân sự (`staff/`)

Quản lý hồ sơ nhân viên, phân quyền theo vai trò (CEO/ADMIN/HR) và import danh sách nhân viên từ Excel/CSV.

## Cấu trúc
- `staff.rules.ts`: validate lương, phụ cấp, hợp đồng, ngày tháng.
- `staffImport.parser.ts`: đọc file Excel/CSV nhân sự.
- `staff.service.ts`: danh sách, tạo mới, cập nhật hồ sơ, khóa tài khoản và xóa cache auth.
