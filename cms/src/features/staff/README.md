# Feature Nhân sự & Hồ sơ (`staff/`)

Quản lý tài khoản nhân viên, hồ sơ nhân sự HR (lương, hợp đồng, BHXH), import Excel nhân sự và hồ sơ cá nhân.

## Cấu trúc
- `api.ts`: Gọi API parse file import nhân sự (`parseStaffImportFileApi`).
- `utils.ts`: Định dạng/parse tiền tệ, ngày tháng và kiểu dòng import.
- `exports.ts`: Xuất danh sách nhân viên và tải file mẫu import.
- `hooks/useStaffModule.ts`: State và handler quản lý nhân sự.
- `components/`: `StaffModule.tsx`, `StaffCreateForm.tsx`, `StaffListTable.tsx`, `StaffImportPreviewModal.tsx`, `StaffPasswordModal.tsx`, `StaffEditProfileModal.tsx`, `AccountProfileModule.tsx`.
