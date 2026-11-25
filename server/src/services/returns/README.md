# Nghiệp vụ Đổi / Trả hàng (`returns/`)

Tính toán và lập phiếu **Trả hàng (`RETURN`, mã `TH-xxxx`)** và **Đổi hàng (`EXCHANGE`, mã `DH-xxxx`)** theo từng dòng sản phẩm/biến thể, phân bổ giảm giá bill và phí quẹt thẻ, đồng thời hoàn/trừ công nợ và tồn kho nguyên tử.

## Cấu trúc
- `returnCode.service.ts`: sinh mã phiếu `TH-xxxx` (trả hàng) và `DH-xxxx` (đổi hàng) chống trùng.
- `returnCalc.service.ts`: tính chênh lệch trả/đổi hàng, phân bổ giảm giá bill và phí thẻ hoàn lại.
- `return.service.ts`: liệt kê phiếu và thực thi giao dịch trả/đổi hàng có khóa tuần tự theo đơn gốc + rollback nếu lỗi.
