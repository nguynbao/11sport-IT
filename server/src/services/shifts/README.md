# Nghiệp vụ Xếp ca tuần (`shifts/`)

Quản lý đăng ký nguyện vọng ca của Sales và bảng phân ca tuần của HR.

## Quy tắc chính
- Sales đăng ký đủ 7 ngày/tuần, mặc định tối đa 2 ngày nghỉ/tuần (1 OFF không lương + 1 phép có lương); từ 3 ngày nghỉ trở lên phải tạo đơn trước 21 ngày.
- Đăng ký 2 ca (`BOTH`) tự động giữ `BOTH` nếu ngày đó còn ca trống, hoặc random 1 ca nếu cả 2 ca đã có người.
- HR xếp lịch linh hoạt qua `assignWeekBulk`; khi `confirmWeek = true` sẽ chốt `assignedBy = 'HR'`, duyệt các đơn `PAID_LEAVE` khớp ngày OFF và bật thông báo lịch mới cho Sales.

## Cấu trúc
- `schedule.rules.ts`: hàm thuần tính thứ Hai tuần này / tuần sau.
- `weeklyPreference.service.ts`: đăng ký nguyện vọng, xem lịch cá nhân, đánh dấu đã xem.
- `schedule.service.ts`: xem lịch toàn công ty, xếp ca đơn lẻ và hàng loạt.
