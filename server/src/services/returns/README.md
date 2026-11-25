# Nghiệp vụ Đổi / Trả hàng (`returns/`)

Tính toán và lập phiếu đổi hàng (`EXCHANGE`) theo từng dòng sản phẩm/biến thể, phân bổ giảm giá bill và phí quẹt thẻ, đồng thời hoàn/trừ công nợ và tồn kho nguyên tử.

## Cấu trúc
- `returnCode.service.ts`: sinh mã phiếu `DH-xxxx` / `TH-xxxx` chống trùng.
- `returnCalc.service.ts`: tính chênh lệch đổi hàng, phân bổ giảm giá bill và phí thẻ hoàn lại.
- `return.service.ts`: liệt kê phiếu và thực thi giao dịch đổi hàng có khóa tuần tự + rollback nếu lỗi.
