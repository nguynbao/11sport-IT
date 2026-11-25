# Feature Chấm công & Bảng công (`attendance/`)

Quản lý bảng công tháng toàn công ty, duyệt nghỉ/WFH, cấu hình IP mạng chấm công, lịch công cá nhân và thanh chấm công nhanh.

## Cấu trúc
- `api.ts`: API ngày lễ, lịch sử chấm công, cấu hình IP, bảng công tháng và lịch cá nhân.
- `timesheet.constants.ts`: Hằng số màu/ký hiệu ô công, ca mặc định và helper format giờ công.
- `components/`: `AttendanceTimesheetModule.tsx` (kèm `TimesheetKpiCard`, `TimesheetMatrixView`, `TimesheetSummaryView`, `Time24Input`, `TimesheetCellDetailModal`, `ManualAttendanceModal`), `HrmAttendanceModule.tsx`, `AttendanceIpConfigModule.tsx`, `MyAttendanceCalendar.tsx`, `HeaderAttendanceBar.tsx`.
