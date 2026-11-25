# Reports Domain

Báo cáo tổng hợp doanh thu, hoạt động nhân viên và sản phẩm cần đẩy mạnh.

- `reports.helpers.ts`: Hàm dùng chung tính công nợ đơn hàng, chuẩn hóa khoảng ngày local và type hoạt động.
- `staffActivity.report.ts`: Báo cáo hoạt động bán hàng và kiểm kho theo nhân viên (`getReportsStaffActivity`).
- `revenueDashboard.report.ts`: Báo cáo doanh thu chi tiết, lợi nhuận, công nợ và hiệu suất sản phẩm (`getReportsRevenueDashboard`).
- `pushProducts.report.ts`: Danh sách sản phẩm cần đẩy mạnh cho Marketing (`getReportsPushProducts`).
