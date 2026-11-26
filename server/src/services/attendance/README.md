# Nghiệp vụ Chấm công (`attendance/`)

Quản lý Check-in, Check-out, lịch sử chấm công cá nhân và cấu hình mạng IP/chi nhánh.

## Quy tắc chính
- Kiểm tra IP chi nhánh (bao gồm DDNS/WAN IP) trước khi cho phép chấm công tại cửa hàng; WFH cần có đơn `WFH` đã duyệt.
- Khối Sales: khi Check-out ca 1 hoặc kết ca tối phải kiểm tra phiếu bàn giao ca (`handover/`); nếu có `requireConfirmation` sẽ khóa `pendingCheckOutTime` chờ ca sau xác nhận.
- Check-out trễ > 5 phút (Sales) cần `lateCheckoutReason`.

## Cấu trúc
- `attendance.rules.ts`: hàm thuần kiểm tra IP, dải mạng và ngày hiện tại.
- `attendanceConfig.service.ts`: cấu hình mạng chi nhánh, resolve DDNS & WAN IP.
- `attendance.service.ts`: luồng `checkIn`, `checkOut`, `getTodayAttendance`, `getAttendanceHistory`.
