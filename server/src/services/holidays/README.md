# Nghiệp vụ Ngày lễ (`holidays/`)

Quản lý ngày lễ Việt Nam (Dương lịch + Âm lịch tự động) và ngày lễ riêng của công ty.

## Quy tắc chính
- Lịch Âm lịch được tính nội bộ theo thuật toán Hồ Ngọc Đức (`lunarCalendar.rules.ts`), kết hợp fallback Nager.Date API khi có mạng.
- Ngày lễ công ty trong DB ghi đè lịch chuẩn VN; bản ghi `name === '__DELETED__'` dùng để ẩn một ngày lễ mặc định VN.

## Cấu trúc
- `lunarCalendar.rules.ts`: thuật toán chuyển đổi Dương → Âm lịch thuần túy.
- `holidays.service.ts`: đồng bộ, truy vấn, tạo/ẩn ngày lễ.
