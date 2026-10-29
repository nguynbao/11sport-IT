# Dự án bán hàng 11 Sport

## Cấu trúc
- `server/` : API, database, nghiệp vụ (đơn hàng, sản phẩm, kho, thanh toán, khuyến mãi)
- `web/`    : website bán hàng cho khách (danh mục, tìm kiếm, giỏ hàng, checkout, tài khoản)
- `cms/`    : trang quản trị (sản phẩm, đơn hàng, khách hàng, banner, bài viết, báo cáo)

## Quy tắc chung cho mọi agent
1. Trả lời bằng tiếng Việt, ngắn gọn, đi thẳng vào việc.
2. Trước khi làm: đọc code hiện có, KHÔNG đoán stack. Nếu thiếu thông tin thì hỏi BA/PM.
3. Mọi thay đổi chạm API phải cập nhật hợp đồng API (`docs/api-contract.md`) trước khi code.
4. Không commit secret/.env. Không chạy lệnh phá hủy (drop DB, force push) khi chưa được PM duyệt.
5. Mỗi agent kết thúc bằng một "Phiếu bàn giao" theo mẫu trong prompt của mình.
6. Thông tin liên quan thanh toán, dữ liệu khách hàng: luôn xét bảo mật trước.

## Luồng làm việc
PM -> BA -> Design -> Dev (backend -> frontend, devops song song) -> Tester -> PM

## Thư mục tài liệu
docs/requirements/  (BA)   docs/design/ (Design)   docs/api-contract.md (Backend)
docs/test/ (Tester)        docs/status.md (PM)
