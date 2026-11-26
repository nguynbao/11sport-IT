# Nghiệp vụ Nhập kho (`imports/`)

Quản lý phiếu nhập kho (lập danh sách, chốt danh sách, kiểm đếm bằng barcode/OCR tag, và hoàn thành ghi sổ tồn kho).

## Cấu trúc
- `importLock.rules.ts`: khóa tuần tự theo mã/ID phiếu chống tạo trùng hoặc ghi sổ 2 lần.
- `import.rules.ts`: hàm thuần chuẩn hóa dòng nhập, giá nhập/bán, giữ trạng thái kiểm đếm.
- `importFileParse.service.ts`: parse Excel/CSV/PDF và OCR bảng hàng hóa.
- `importReceipt.service.ts`: CRUD phiếu nhập và chốt danh sách (`finishListing`).
- `importScan.service.ts`: kiểm đếm (`scanCheck`), quét tag OCR học barcode (`scanTag`) và hoàn thành ghi sổ (`completeImport`).
