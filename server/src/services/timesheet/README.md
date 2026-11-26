# Nghiệp vụ Bảng công tháng (`timesheet/`)

Tổng hợp bảng công tháng cho toàn công ty, lịch công cá nhân và thao tác điều chỉnh / chấm công bù của HR.

## Quy tắc chính
- Văn phòng làm 8h/ngày (08:30–17:30, nghỉ trưa 12:00–13:00), cho phép trễ **5 phút**; Sales làm theo ca (`SHIFT_1` 08:30–17:30, `SHIFT_2` 12:00–21:00, `BOTH` 08:30–21:00), cho phép trễ **0 phút** (không du di).
- Ngày lễ chính thức (`isOfficialDayOff`): khối Văn phòng được nghỉ và vẫn tính 1 công (nếu rơi vào T2–T7), đi làm được nhân hệ số x4; khối Sales ngày lễ là ngày làm bình thường, đi làm nhân hệ số x4.
- HR có thể điều chỉnh giờ công, xét duyệt tăng ca, chấm OFF hoặc chấm công bù qua `manualAttendance.service.ts`.

## Cấu trúc
- `timesheet.rules.ts`: hàm thuần tính giờ làm, đi trễ, về sớm, ca chuẩn và hệ số tăng ca.
- `timesheet.queries.ts`: `buildTimesheet`, báo cáo bảng công và lịch cá nhân.
- `manualAttendance.service.ts`: điều chỉnh bản ghi và chấm công bù.
