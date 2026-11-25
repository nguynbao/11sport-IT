# Feature Báo cáo & Phân tích (`reports/`)

Dashboard doanh thu chi tiết, lãi gộp, công nợ, hoạt động bán hàng/kiểm kho nhân viên và danh sách sản phẩm cần đẩy mạnh.

## Cấu trúc
- `utils.ts`: Hàm thuần `parseLocalDateBound` và `extractClientOrderDebtMeta`.
- `fallbackDashboard.ts`: Tính toán dự phòng phía client (`buildClientFallbackDashboard`).
- `exports.ts`: Xuất Excel báo cáo doanh thu, hoạt động nhân viên và sản phẩm cần đẩy.
- `hooks/useRevenueDashboard.ts`: State, bộ lọc kỳ và nạp dữ liệu dashboard.
- `components/`: `RevenueDashboardModule.tsx`, `RevenueCharts.tsx`, 4 tab (`RevenueOverviewTab`, `RevenueProductsTab`, `RevenueServiceTab`, `RevenueDebtTab`), `StaffActivityModule.tsx`, `MarketingPushProductsModule.tsx`.
