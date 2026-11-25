# Nghiệp vụ Kho hàng (`inventory/`)

Quản lý tồn kho đa tầng (Kho Tầng 1 bán hàng, Kho Tầng 2 lưu trữ), điều chuyển tầng, điều chỉnh kiểm kê và tách sản phẩm Bộ sang Lẻ.

## Cấu trúc
- `warehouseFloor.rules.ts`: hàm thuần tính tồn kho theo tầng, biến thể và chuẩn hóa biến thể.
- `unpackSet.service.ts`: tách sản phẩm Bộ sang Lẻ và liên kết bộ-lẻ.
- `inventory.queries.ts`: lịch sử xuất nhập kho (`movements`), báo cáo tồn kho, lịch sử chuyển tầng.
- `stockAdjustment.service.ts`: điều chỉnh tồn kho và thao tác tách bộ thủ công.
- `stockTransfer.service.ts`: chuyển kho giữa Tầng 1 và Tầng 2.
