# Nghiệp vụ Bảng công tháng (`timesheet/`)

Tổng hợp bảng công tháng cho toàn công ty, lịch công cá nhân và thao tác điều chỉnh / chấm công bù của HR.

## Quy tắc chính
- Văn phòng làm 8h/ngày (nghỉ trưa 12:00–13:00), cho phép trễ 5 phút; Sales làm theo ca (`SHIFT_1`, `SHIFT_2`, `BOTH`), cho phép trễ 10 phút.
- Ngày lễ chính thức (`isOfficialDayOff`) được tính công cho nhân viên Văn phòng hoặc nhân hệ số 4 nếu đi làm.
- HR có thể điều chỉnh giờ công, xét duyệt tăng ca, chấm OFF hoặc chấm công bù qua `manualAttendance.service.ts`.

## Cấu trúc
- `timesheet.rules.ts`: hàm thuần tính giờ làm, đi trễ, về sớm, ca chuẩn.
- `timesheet.queries.ts`: `buildTimesheet`, báo cáo bảng công và lịch cá nhân.
- `manualAttendance.service.ts`: điều chỉnh bản ghi và chấm công bù.
