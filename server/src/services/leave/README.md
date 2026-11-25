# Nghiệp vụ Đơn nghỉ & Quỹ phép (`leave/`)

Quản lý đơn xin nghỉ (OFF, PAID_LEAVE, WFH, LATE, EARLY, CHANGE_OFF), tính quỹ phép năm và kiểm tra hạn mức nghỉ.

## Quy tắc chính
- **Phép có lương (`PAID_LEAVE`):** Chỉ hợp đồng Chính thức (`FULLTIME`), tích lũy từ giai đoạn thử việc (tối đa 2 tháng) + 1 ngày/tháng chính thức; dùng từ 2 ngày phép trở lên phải tạo đơn trước 21 ngày (tối đa 7 ngày liên tiếp).
- **Nghỉ không lương (`OFF`):** Khối Sales tối đa 4 ngày/tháng; từ 3 ngày nghỉ/tuần trở lên phải tạo đơn trước 21 ngày.
- **Đổi ngày OFF (`CHANGE_OFF`):** Khi duyệt sẽ tự động cập nhật đơn nghỉ và đồng bộ `ShiftAssignment`.

## Cấu trúc
- `leaveQuota.rules.ts`: hằng số quy định và hàm thuần tính quỹ phép, chuỗi ngày phép liên tiếp.
- `leaveQuota.queries.ts`: kiểm tra hạn mức thực tế từ DB.
- `leaveRequest.service.ts`: tạo, liệt kê, hủy và duyệt đơn.
