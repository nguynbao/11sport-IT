# Feature Kho hàng (`inventory/`)

Quản lý tồn kho đa tầng (Kho Tầng 1 bán hàng, Kho Tầng 2 lưu trữ), phiếu nhập kho, điều chuyển tầng, báo cáo nhập-xuất-tồn và liên kết tách Bộ ↔ Lẻ.

## Cấu trúc
- `types.ts`: Kiểu dữ liệu nội bộ (`SubTab`, `HistoryView`, `ActiveWarehouseTab`, `QuickStockFilter`, `AdminImportRow`, `COMMON_COLORS`, `COMMON_SIZES`).
- `exports.ts`: Xuất Excel sản phẩm, báo cáo tồn kho, sổ kho và phiếu nhập kho.
- `hooks/useInventoryModule.tsx`: State, bộ lọc, quét mã vạch và các handler nghiệp vụ kho.
- `components/`: `InventoryModule.tsx` (container) ghép 4 tab (`InventoryProductsTab`, `InventoryReportTab`, `InventoryHistoryTab`, `InventoryTransferTab`), 3 modal (`ImportReceiptDetailModal`, `AdminBatchImportModal`, `SetLinkModal`) và `CmsRoleBadge`.
