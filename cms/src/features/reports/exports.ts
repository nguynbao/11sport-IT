import type {
  DailyRevenueTrend,
  Product,
  ProductSalesAnalysisRow,
  RevenueByCategory,
  RevenueDashboardData,
  SalesActivity,
  StaffActivityReport,
  StaffActivitySummary,
  WarehouseActivity,
} from "@/shared/types";
import { ORDER_STATUS_LABELS as ORDER_STATUS, PAYMENT_LABELS as PAYMENT, ROLE_LABELS as ROLE } from "@/shared/lib/exportLabels";
import { buildSheet, downloadExcel, excelFileName, ExcelColumn, toDate } from "@/shared/lib/excel";

/* ------------------------- Hoạt động nhân viên ------------------------- */

export const SALES_ACTIVITY_LABEL: Record<string, string> = {
  ORDER: "Bán hàng",
  RETURN: "Trả hàng",
  EXCHANGE: "Đổi hàng",
};
export const WAREHOUSE_ACTIVITY_LABEL: Record<string, string> = {
  IMPORT_CREATED: "Lập phiếu nhập",
  IMPORT_CHECKED: "Quét kiểm hàng",
  IMPORT_COMPLETED: "Hoàn thành nhập kho",
  ADJUSTMENT: "Điều chỉnh kho",
  EXPORT_TRANSFER: "Xuất kho chuyển tầng (PXK)",
};

export function exportStaffActivity(report: StaffActivityReport, from?: string, to?: string) {
  const period = `Kỳ: ${from || "đầu kỳ"} → ${to || "hiện tại"}`;
  const subtitle = `${period} — Xuất lúc ${new Date().toLocaleString("vi-VN")}`;

  const summaryCols: ExcelColumn<StaffActivitySummary>[] = [
    { header: "Mã NV", value: (s) => s.code },
    { header: "Họ và tên", value: (s) => s.fullName, width: 26 },
    { header: "Vai trò", value: (s) => ROLE[s.role] || s.role || "" },
    { header: "Số đơn bán", value: (s) => s.sales.orders, format: "int", total: true },
    { header: "Doanh thu", value: (s) => s.sales.revenue, format: "money", total: true },
    { header: "SP đã bán", value: (s) => s.sales.units, format: "int", total: true },
    { header: "Phiếu trả/đổi", value: (s) => s.sales.returnsHandled, format: "int", total: true },
    { header: "Phiếu nhập lập", value: (s) => s.warehouse.importsCreated, format: "int", total: true },
    { header: "Chiếc đã quét kiểm", value: (s) => s.warehouse.unitsScanned, format: "int", total: true },
    { header: "Dòng đã kiểm", value: (s) => s.warehouse.rowsChecked, format: "int", total: true },
    { header: "Phiếu nhập hoàn thành", value: (s) => s.warehouse.importsCompleted, format: "int", total: true },
    { header: "SL nhập kho", value: (s) => s.warehouse.unitsImported, format: "int", total: true },
    { header: "Phiếu xuất kho chuyển tầng (PXK)", value: (s) => s.warehouse.transfers || 0, format: "int", total: true },
    { header: "SL xuất chuyển tầng", value: (s) => s.warehouse.unitsTransferred || 0, format: "int", total: true },
    { header: "Điều chỉnh kho", value: (s) => s.warehouse.adjustments, format: "int", total: true },
    { header: "Hoạt động gần nhất", value: (s) => toDate(s.lastActivityAt), format: "datetime", width: 17 },
  ];

  const salesCols: ExcelColumn<SalesActivity>[] = [
    { header: "Thời gian", value: (a) => toDate(a.at), format: "datetime", width: 17 },
    { header: "Nhân viên", value: (a) => a.staffName, width: 24 },
    { header: "Loại", value: (a) => SALES_ACTIVITY_LABEL[a.type] || a.type },
    { header: "Chứng từ", value: (a) => a.referenceCode },
    { header: "Khách hàng", value: (a) => a.customerName },
    { header: "Số SP", value: (a) => a.units, format: "int", total: true },
    { header: "Số tiền", value: (a) => a.amount, format: "money", total: true },
    { header: "Thanh toán", value: (a) => PAYMENT[a.paymentMethod] || a.paymentMethod },
    {
      header: "Trạng thái / Đơn gốc",
      value: (a) => (a.type === "ORDER" ? ORDER_STATUS[a.status] || a.status : a.status),
    },
  ];

  const whCols: ExcelColumn<WarehouseActivity>[] = [
    { header: "Thời gian", value: (a) => toDate(a.at), format: "datetime", width: 17 },
    { header: "Nhân viên", value: (a) => a.staffName, width: 24 },
    { header: "Thao tác", value: (a) => WAREHOUSE_ACTIVITY_LABEL[a.type] || a.type },
    { header: "Chứng từ", value: (a) => a.referenceCode },
    { header: "Số lượng", value: (a) => a.quantity, format: "int" },
    { header: "Chi tiết", value: (a) => a.detail, width: 50 },
  ];

  downloadExcel(excelFileName("HoatDong_NhanVien"), [
    buildSheet("Tong hop", summaryCols, report.staff, { title: "TỔNG HỢP HOẠT ĐỘNG NHÂN VIÊN", subtitle }),
    buildSheet("Ban hang", salesCols, report.sales, { title: "NHẬT KÝ BÁN HÀNG / TRẢ ĐỔI THEO NHÂN VIÊN", subtitle }),
    buildSheet("Kiem kho", whCols, report.warehouse, { title: "NHẬT KÝ KIỂM KHO / NHẬP KHO THEO NHÂN VIÊN", subtitle }),
  ]);
}

/* ---------------- Báo cáo Doanh thu chi tiết & Sản phẩm ---------------- */

export function exportRevenueDashboard(data: RevenueDashboardData, from?: string, to?: string) {
  const period = `Kỳ: ${from || "đầu kỳ"} → ${to || "hiện tại"}`;
  const subtitle = `${period} — Xuất lúc ${new Date().toLocaleString("vi-VN")}`;

  const dailyCols: ExcelColumn<DailyRevenueTrend>[] = [
    { header: "Ngày", value: (d) => d.date, width: 14 },
    { header: "Số đơn", value: (d) => d.orders, format: "int", total: true },
    { header: "SL bán", value: (d) => d.unitsSold, format: "int", total: true },
    { header: "Doanh thu gộp", value: (d) => d.grossRevenue, format: "money", total: true },
    { header: "Giảm giá", value: (d) => d.discountTotal, format: "money", total: true },
    { header: "Doanh thu đơn hàng", value: (d) => d.orderRevenue, format: "money", total: true },
    { header: "Chênh lệch Trả/Đổi", value: (d) => d.returnImpact, format: "money", total: true },
    { header: "Doanh thu thuần", value: (d) => d.netRevenue, format: "money", total: true },
    { header: "Thực thu (vào quỹ)", value: (d) => d.cashCollected ?? 0, format: "money", total: true },
    { header: "Giá vốn (COGS)", value: (d) => d.cogs, format: "money", total: true },
    { header: "Lãi gộp", value: (d) => d.grossProfit, format: "money", total: true },
  ];

  const topCols: ExcelColumn<ProductSalesAnalysisRow>[] = [
    { header: "Hạng", value: (_, i) => i + 1, format: "int", width: 7 },
    { header: "Mã hàng", value: (p) => p.productCode },
    { header: "Tên sản phẩm", value: (p) => p.productName, width: 45 },
    { header: "Category", value: (p) => p.categoryName },
    { header: "ĐVT", value: (p) => p.unit, width: 8 },
    { header: "SL Bán thuần", value: (p) => p.netSoldQty, format: "int", total: true },
    { header: "SL Tặng (0đ)", value: (p) => p.giftQty, format: "int", total: true },
    { header: "SL Hoàn trả", value: (p) => p.returnedQty, format: "int", total: true },
    { header: "Số đơn", value: (p) => p.orderCount, format: "int" },
    { header: "Doanh thu thuần", value: (p) => p.revenue, format: "money", total: true },
    { header: "Giá vốn", value: (p) => p.cogs, format: "money", total: true },
    { header: "Lãi gộp", value: (p) => p.grossProfit, format: "money", total: true },
    { header: "Biên lãi (%)", value: (p) => `${p.marginPercent}%`, width: 12 },
    { header: "Tồn Kho Tầng 1", value: (p) => p.stockFloor1, format: "int", total: true },
    { header: "Tồn Kho Tầng 2", value: (p) => p.stockFloor2, format: "int", total: true },
    { header: "Tổng tồn", value: (p) => p.stock, format: "int", total: true },
    { header: "Cảnh báo tồn kho", value: (p) => p.restockAlert || "Ổn định", width: 35 },
  ];

  const pushCols: ExcelColumn<ProductSalesAnalysisRow>[] = [
    { header: "Ưu tiên", value: (_, i) => i + 1, format: "int", width: 8 },
    { header: "Mã hàng", value: (p) => p.productCode },
    { header: "Tên sản phẩm", value: (p) => p.productName, width: 45 },
    { header: "Category", value: (p) => p.categoryName },
    { header: "ĐVT", value: (p) => p.unit, width: 8 },
    { header: "Tồn Kho Tầng 1", value: (p) => p.stockFloor1, format: "int", total: true },
    { header: "Tồn Kho Tầng 2", value: (p) => p.stockFloor2, format: "int", total: true },
    { header: "Tổng tồn", value: (p) => p.stock, format: "int", total: true },
    { header: "SL đã bán trong kỳ", value: (p) => p.netSoldQty, format: "int", total: true },
    { header: "Giá vốn", value: (p) => p.costPrice, format: "money" },
    { header: "Giá niêm yết", value: (p) => p.sellingPrice, format: "money" },
    { header: "Vốn tồn đọng", value: (p) => p.inventoryCostValue, format: "money", total: true },
    { header: "Lý do cần đẩy mạnh", value: (p) => p.pushReasons.join("; "), width: 45 },
    { header: "Đề xuất hành động", value: (p) => p.suggestedAction, width: 45 },
  ];

  const catCols: ExcelColumn<RevenueByCategory>[] = [
    { header: "Category", value: (c) => c.categoryName, width: 28 },
    { header: "SL Bán", value: (c) => c.unitsSold, format: "int", total: true },
    { header: "Doanh thu", value: (c) => c.revenue, format: "money", total: true },
    { header: "Giá vốn", value: (c) => c.cogs, format: "money", total: true },
    { header: "Lãi gộp", value: (c) => c.grossProfit, format: "money", total: true },
    { header: "Tỷ trọng (%)", value: (c) => `${c.sharePercent}%`, width: 14 },
  ];

  downloadExcel(excelFileName("Dashboard_DoanhThu_SanPham"), [
    buildSheet("Doanh thu theo ngay", dailyCols, data.dailyTrend, {
      title: "BÁO CÁO DOANH THU & LỢI NHUẬN CHI TIẾT THEO NGÀY",
      subtitle,
    }),
    buildSheet("SP Ban chay", topCols, data.topSellingProducts, {
      title: "TOP SẢN PHẨM ĐANG BÁN CHẠY (BEST SELLERS)",
      subtitle,
    }),
    buildSheet("Theo Category", catCols, data.byCategory, {
      title: "DOANH THU THEO DANH MỤC (CATEGORY)",
      subtitle,
    }),
  ]);
}

export function exportPushProducts(
  rows: ProductSalesAnalysisRow[],
  from?: string,
  to?: string
): void {
  const period =
    from || to ? `${from || "Đầu kỳ"} → ${to || "Hiện tại"}` : "Toàn thời gian";
  const subtitle = `Kỳ thống kê: ${period} · Thời điểm xuất: ${new Date().toLocaleString("vi-VN")}`;

  const pushCols: ExcelColumn<ProductSalesAnalysisRow>[] = [
    { header: "Thứ tự", value: (_p, i) => i + 1, format: "int", width: 8 },
    { header: "Mã hàng", value: (p) => p.productCode },
    { header: "Tên sản phẩm", value: (p) => p.productName, width: 45 },
    { header: "Category", value: (p) => p.categoryName },
    { header: "ĐVT", value: (p) => p.unit, width: 8 },
    { header: "Tồn Kho Tầng 1", value: (p) => p.stockFloor1, format: "int", total: true },
    { header: "Tồn Kho Tầng 2", value: (p) => p.stockFloor2, format: "int", total: true },
    { header: "Tổng tồn", value: (p) => p.stock, format: "int", total: true },
    { header: "SL đã bán trong kỳ", value: (p) => p.netSoldQty, format: "int", total: true },
    { header: "Giá vốn", value: (p) => p.costPrice, format: "money" },
    { header: "Giá niêm yết", value: (p) => p.sellingPrice, format: "money" },
    { header: "Vốn tồn đọng", value: (p) => p.inventoryCostValue, format: "money", total: true },
    { header: "Lý do cần đẩy mạnh", value: (p) => p.pushReasons.join("; "), width: 45 },
    { header: "Đề xuất hành động", value: (p) => p.suggestedAction, width: 45 },
  ];

  downloadExcel(excelFileName("Marketing_SP_CanDayManh"), [
    buildSheet("SP Can day manh", pushCols, rows, {
      title: "DANH SÁCH CÁC SẢN PHẨM ĐANG CẦN ĐẨY MẠNH (BỘ PHẬN MARKETING)",
      subtitle,
    }),
  ]);
}
