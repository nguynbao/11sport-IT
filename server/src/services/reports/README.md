# Nghiệp vụ Báo cáo (`reports/`)

Báo cáo tổng hợp doanh thu, hoạt động nhân viên và sản phẩm cần đẩy mạnh.

## Cấu trúc
- `reports.helpers.ts`: hàm dùng chung tính công nợ đơn hàng, chuẩn hóa khoảng ngày local và type hoạt động.
- `staffActivity.report.ts`: báo cáo hoạt động bán hàng và kiểm kho theo nhân viên (`getReportsStaffActivity`).
- `revenueDashboard.report.ts`: báo cáo doanh thu chi tiết, lợi nhuận, công nợ và hiệu suất sản phẩm (`getReportsRevenueDashboard`).
- `pushProducts.report.ts`: danh sách sản phẩm cần đẩy mạnh cho Marketing (`getReportsPushProducts`).
