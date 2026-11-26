# Nghiệp vụ Tích hợp ngoài (`integrations/`)

Tích hợp phần cứng và dịch vụ bên ngoài (máy in tem Windows, tỷ giá Wise).

## Cấu trúc
- `printer.service.ts`: lấy danh sách máy in hệ thống và gửi lệnh in tem mã vạch trực tiếp.
- `wise.service.ts`: lấy danh sách tiền tệ hỗ trợ và tra cứu tỷ giá quy đổi qua Wise API.
