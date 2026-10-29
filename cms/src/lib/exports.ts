import {
  Category,
  InventoryReportRow,
  Order,
  Product,
  ReturnReceipt,
  StaffUser,
  StockMovement,
  StaffActivityReport,
  StaffActivitySummary,
  SalesActivity,
  WarehouseActivity,
} from "./api";
import { buildSheet, downloadExcel, excelFileName, ExcelColumn, toDate } from "./excel";

/* Nhãn tiếng Việt cho các mã trạng thái */
const MOVEMENT_LABEL: Record<string, string> = {
  IMPORT: "Nhập kho",
  SALE: "Bán hàng",
  RETURN: "Trả hàng",
  EXCHANGE_IN: "Nhận hàng đổi",
  EXCHANGE_OUT: "Xuất hàng đổi",
  ADJUSTMENT: "Điều chỉnh kho",
  TRANSFER: "Xuất kho chuyển tầng (PXK)",
};
const IMPORT_STATUS: Record<string, string> = {
  DRAFT: "Nháp",
  CHECKING: "Đang kiểm",
  COMPLETED: "Hoàn thành",
};
const ORDER_STATUS: Record<string, string> = {
  PAID: "Đã bán",
  PARTIALLY_RETURNED: "Trả 1 phần",
  FULLY_RETURNED: "Trả toàn bộ",
};
const PAYMENT: Record<string, string> = {
  CASH: "Tiền mặt",
  BANKING: "Chuyển khoản",
  CARD: "Thẻ",
};
const ROLE: Record<string, string> = {
  SALES: "Nhân viên bán hàng",
  WAREHOUSE: "Thủ kho",
  ADMIN: "Quản lý",
};

const categoryNameOf = (p: Product) =>
  p.categoryName || (typeof p.categoryId === "object" ? p.categoryId?.name : "") || "";

/* ------------------------------- Sản phẩm ------------------------------- */

export function exportProducts(products: Product[]) {
  const cols: ExcelColumn<Product>[] = [
    { header: "STT", value: (_, i) => i + 1, format: "int", width: 6 },
    { header: "Mã hàng", value: (p) => p.code },
    { header: "Tên sản phẩm", value: (p) => p.name, width: 50 },
    { header: "Category", value: categoryNameOf },
    { header: "ĐVT", value: (p) => p.unit, width: 8 },
    { header: "Tồn Kho Tầng 1", value: (p) => Number(p.stockFloor1 ?? p.stock) || 0, format: "int", total: true },
    { header: "Tồn Kho Tầng 2", value: (p) => Number(p.stockFloor2) || 0, format: "int", total: true },
    { header: "Tổng tồn 2 kho", value: (p) => Number(p.stock) || 0, format: "int", total: true },
    { header: "Giá gốc", value: (p) => Number(p.costPrice) || 0, format: "money" },
    { header: "Giá bán lẻ", value: (p) => Number(p.sellingPrice) || 0, format: "money" },
    {
      header: "Lãi gộp / SP",
      value: (p) => (p.sellingPrice > 0 && Number(p.costPrice) > 0 ? p.sellingPrice - Number(p.costPrice) : null),
      format: "money",
    },
    {
      header: "Giá trị tồn (giá gốc)",
      value: (p) => (Number(p.costPrice) || 0) * (Number(p.stock) || 0),
      format: "money",
      total: true,
    },
    {
      header: "Giá trị tồn (giá bán)",
      value: (p) => (Number(p.sellingPrice) || 0) * (Number(p.stock) || 0),
      format: "money",
      total: true,
    },
    { header: "Trạng thái bán", value: (p) => (p.sellingPrice > 0 ? "Đang bán" : "Chưa có giá bán") },
  ];
  downloadExcel(excelFileName("SanPham_TonKho"), [
    buildSheet("San pham", cols, products, { title: "DANH MỤC SẢN PHẨM & TỒN KHO (TẦNG 1 & TẦNG 2)" }),
  ]);
}

/* --------------------------- Báo cáo tồn theo kỳ --------------------------- */

export function exportInventoryReport(rows: InventoryReportRow[], from?: string, to?: string) {
  const cols: ExcelColumn<InventoryReportRow>[] = [
    { header: "STT", value: (_, i) => i + 1, format: "int", width: 6 },
    { header: "Mã sản phẩm", value: (r) => r.productCode },
    { header: "Tên sản phẩm", value: (r) => r.productName, width: 50 },
    { header: "Category", value: (r) => r.categoryName || "" },
    { header: "ĐVT", value: (r) => r.unit, width: 8 },
    { header: "Tồn đầu kỳ", value: (r) => r.openingStock, format: "int", total: true },
    { header: "Nhập trong kỳ", value: (r) => r.importedQty, format: "int", total: true },
    { header: "Bán trong kỳ", value: (r) => r.soldQty, format: "int", total: true },
    { header: "± Trả/Đổi/Điều chỉnh", value: (r) => r.adjustedAndReturnedQty, format: "int", total: true },
    { header: "Tồn Kho Tầng 1", value: (r) => Number(r.stockFloor1 ?? r.closingStock) || 0, format: "int", total: true },
    { header: "Tồn Kho Tầng 2", value: (r) => Number(r.stockFloor2) || 0, format: "int", total: true },
    { header: "Tổng tồn cuối 2 kho", value: (r) => r.closingStock, format: "int", total: true },
    { header: "Giá gốc (VND)", value: (r) => Number(r.costPrice) || 0, format: "money" },
    { header: "Giá bán (VND)", value: (r) => Number(r.sellingPrice) || 0, format: "money" },
    {
      header: "Giá trị tồn cuối (giá gốc)",
      value: (r) => (Number(r.costPrice) || 0) * (Number(r.closingStock) || 0),
      format: "money",
      total: true,
    },
    {
      header: "Giá trị tồn cuối (giá bán)",
      value: (r) => (Number(r.sellingPrice) || 0) * (Number(r.closingStock) || 0),
      format: "money",
      total: true,
    },
  ];
  const period = `Kỳ báo cáo: ${from || "đầu kỳ"} → ${to || "hiện tại"}`;
  downloadExcel(excelFileName("BaoCao_TonKho"), [
    buildSheet("Bao cao ton kho", cols, rows, {
      title: "BÁO CÁO TỒN KHO THEO KỲ (TẦNG 1 & TẦNG 2)",
      subtitle: `${period} — Tồn cuối = Tồn đầu + Nhập − Bán ± Điều chỉnh — Xuất lúc ${new Date().toLocaleString(
        "vi-VN"
      )}`,
    }),
  ]);
}

/* -------------------------------- Sổ kho -------------------------------- */

export function exportMovements(movements: StockMovement[], typeFilter?: string) {
  const cols: ExcelColumn<StockMovement>[] = [
    { header: "Thời gian", value: (m) => toDate(m.createdAt), format: "datetime", width: 17 },
    { header: "Kho tầng", value: (m) => (m.warehouseLocation === "FLOOR_2" ? "Kho Tầng 2" : "Kho Tầng 1") },
    { header: "Loại giao dịch", value: (m) => MOVEMENT_LABEL[m.type] || m.type },
    { header: "Mã hàng", value: (m) => m.productCode },
    { header: "Tên sản phẩm", value: (m) => m.productName, width: 45 },
    { header: "Số lượng biến động", value: (m) => m.quantityChange, format: "int" },
    { header: "Tồn trước GD", value: (m) => (m as any).balanceBefore ?? null, format: "int" },
    { header: "Số lượng tồn sau GD", value: (m) => m.balanceAfter, format: "int" },
    { header: "Giá gốc (VND)", value: (m) => Number(m.costPrice) || 0, format: "money" },
    { header: "Giá bán (VND)", value: (m) => Number(m.sellingPrice) || 0, format: "money" },
    { header: "Chứng từ", value: (m) => m.referenceCode || "" },
    { header: "Người thực hiện", value: (m) => m.performedByName || "" },
    { header: "Ghi chú", value: (m) => m.note || "", width: 40 },
  ];
  downloadExcel(excelFileName("SoKho"), [
    buildSheet("So kho", cols, movements, {
      title: `SỔ KHO${typeFilter ? ` — ${MOVEMENT_LABEL[typeFilter] || typeFilter}` : ""}`,
    }),
  ]);
}

/* ----------------------------- Phiếu nhập kho ----------------------------- */

/** "Nguyễn A (3), Trần B (1)" — số chiếc mỗi nhân viên đã quét kiểm */
const checkersOf = (items: any[]) => {
  const byName = new Map<string, number>();
  items.forEach((it) =>
    (it.scanCounts || []).forEach((s: any) =>
      byName.set(s.name, (byName.get(s.name) || 0) + (Number(s.quantity) || 0))
    )
  );
  return Array.from(byName.entries())
    .map(([n, q]) => `${n} (${q})`)
    .join(", ");
};

const receiptCostTotal = (imp: any) =>
  (imp.items || []).reduce(
    (s: number, it: any) => s + (Number(it.costPrice) || 0) * (Number(it.actualQuantity) || 0),
    0
  );

export function exportImports(imports: any[]) {
  const summaryCols: ExcelColumn<any>[] = [
    { header: "Mã phiếu", value: (r) => r.code || r.receiptCode || r._id },
    { header: "Kho nhận", value: (r) => (r.targetWarehouse === "FLOOR_2" ? "Kho Tầng 2" : "Kho Tầng 1") },
    { header: "Trạng thái", value: (r) => IMPORT_STATUS[r.status] || r.status },
    { header: "Số dòng hàng", value: (r) => r.items?.length || 0, format: "int", total: true },
    {
      header: "Tổng SL thực nhận",
      value: (r) => (r.items || []).reduce((s: number, it: any) => s + (Number(it.actualQuantity) || 0), 0),
      format: "int",
      total: true,
    },
    { header: "Tổng giá gốc", value: receiptCostTotal, format: "money", total: true },
    { header: "Ghi chú", value: (r) => r.note || "", width: 40 },
    { header: "Người lập", value: (r) => r.createdByName || "" },
    { header: "Người kiểm (chiếc)", value: (r) => checkersOf(r.items || []), width: 30 },
    { header: "Người hoàn thành", value: (r) => r.completedByName || "" },
    { header: "Ngày tạo", value: (r) => toDate(r.createdAt), format: "datetime", width: 17 },
    { header: "Ngày hoàn thành", value: (r) => toDate(r.completedAt), format: "datetime", width: 17 },
  ];

  type Line = { receipt: any; item: any };
  const lines: Line[] = imports.flatMap((r) => (r.items || []).map((item: any) => ({ receipt: r, item })));
  const detailCols: ExcelColumn<Line>[] = [
    { header: "Mã phiếu", value: (l) => l.receipt.code || l.receipt.receiptCode || l.receipt._id },
    { header: "Trạng thái phiếu", value: (l) => IMPORT_STATUS[l.receipt.status] || l.receipt.status },
    { header: "STT", value: (l) => l.item.stt, format: "int", width: 6 },
    { header: "Mã hàng", value: (l) => l.item.productCode },
    { header: "Tên hàng", value: (l) => l.item.productName, width: 50 },
    { header: "ĐVT", value: (l) => l.item.unit, width: 8 },
    { header: "SL dự kiến", value: (l) => Number(l.item.expectedQuantity) || 0, format: "int", total: true },
    { header: "SL thực nhận", value: (l) => Number(l.item.actualQuantity) || 0, format: "int", total: true },
    {
      header: "Chênh lệch",
      value: (l) => (Number(l.item.actualQuantity) || 0) - (Number(l.item.expectedQuantity) || 0),
      format: "int",
    },
    { header: "Giá gốc", value: (l) => Number(l.item.costPrice) || 0, format: "money" },
    {
      header: "Thành tiền (giá gốc)",
      value: (l) => (Number(l.item.costPrice) || 0) * (Number(l.item.actualQuantity) || 0),
      format: "money",
      total: true,
    },
    { header: "Đã kiểm", value: (l) => (l.item.isChecked ? "Có" : "Không"), width: 9 },
    { header: "Xác nhận nhập kho", value: (l) => (l.item.isConfirmed ? "Có" : "Không"), width: 10 },
    { header: "Người kiểm (chiếc)", value: (l) => checkersOf([l.item]), width: 26 },
    { header: "Ghi chú chênh lệch", value: (l) => l.item.discrepancyNote || "", width: 30 },
    { header: "Ghi chú", value: (l) => l.item.note || "", width: 30 },
  ];

  downloadExcel(excelFileName("PhieuNhapKho"), [
    buildSheet("Phieu nhap", summaryCols, imports, { title: "DANH SÁCH PHIẾU NHẬP KHO" }),
    buildSheet("Chi tiet hang nhap", detailCols, lines, { title: "CHI TIẾT HÀNG NHẬP THEO PHIẾU" }),
  ]);
}

/* -------------------------------- Đơn hàng -------------------------------- */

export function exportOrders(orders: Order[]) {
  const orderCols: ExcelColumn<Order>[] = [
    { header: "Mã đơn", value: (o) => o.orderCode || o.code || o._id },
    { header: "Ngày bán", value: (o) => toDate(o.createdAt), format: "datetime", width: 17 },
    { header: "Khách hàng", value: (o) => o.customerName },
    { header: "SĐT", value: (o) => o.customerPhone },
    { header: "Thanh toán", value: (o) => PAYMENT[o.paymentMethod] || o.paymentMethod },
    {
      header: "Số SP",
      value: (o) => (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
      format: "int",
      total: true,
    },
    { header: "Tiền hàng (niêm yết)", value: (o) => Number(o.rawSubtotal || o.subtotal) || 0, format: "money", total: true },
    { header: "Giảm giá SP", value: (o) => Number(o.itemDiscountTotal) || 0, format: "money", total: true },
    { header: "Giảm giá Bill", value: (o) => Number(o.billDiscountAmount) || 0, format: "money", total: true },
    { header: "Phí thẻ 3%", value: (o) => Number(o.cardFee) || 0, format: "money", total: true },
    { header: "Tổng thu", value: (o) => Number(o.totalAmount) || 0, format: "money", total: true },
    { header: "Trạng thái", value: (o) => ORDER_STATUS[o.status] || o.status },
    { header: "Nhân viên bán", value: (o) => o.soldByName || o.createdByName || "" },
    { header: "Ghi chú", value: (o) => o.note || "", width: 30 },
  ];

  type Line = { order: Order; item: Order["items"][number] };
  const lines: Line[] = orders.flatMap((o) => (o.items || []).map((item) => ({ order: o, item })));
  const lineCols: ExcelColumn<Line>[] = [
    { header: "Mã đơn", value: (l) => l.order.orderCode || l.order.code || l.order._id },
    { header: "Ngày bán", value: (l) => toDate(l.order.createdAt), format: "datetime", width: 17 },
    { header: "Khách hàng", value: (l) => l.order.customerName },
    { header: "Mã hàng", value: (l) => l.item.productCode },
    { header: "Tên sản phẩm", value: (l) => l.item.productName, width: 45 },
    { header: "ĐVT", value: (l) => l.item.unit, width: 8 },
    { header: "Đơn giá", value: (l) => Number(l.item.unitPrice) || 0, format: "money" },
    { header: "Số lượng", value: (l) => Number(l.item.quantity) || 0, format: "int", total: true },
    { header: "Đã trả lại", value: (l) => Number(l.item.returnedQuantity) || 0, format: "int", total: true },
    {
      header: "Thành tiền",
      value: (l) => Number(l.item.lineTotal) || (Number(l.item.unitPrice) || 0) * (Number(l.item.quantity) || 0),
      format: "money",
      total: true,
    },
  ];

  downloadExcel(excelFileName("DonHang"), [
    buildSheet("Don hang", orderCols, orders, { title: "DANH SÁCH ĐƠN HÀNG POS" }),
    buildSheet("Chi tiet don hang", lineCols, lines, { title: "CHI TIẾT SẢN PHẨM THEO ĐƠN HÀNG" }),
  ]);
}

/* ------------------------------ Trả / Đổi hàng ------------------------------ */

export function exportReturns(returns: ReturnReceipt[]) {
  const cols: ExcelColumn<ReturnReceipt>[] = [
    { header: "Mã phiếu", value: (r) => r.returnCode || r.code || r._id },
    { header: "Đơn hàng gốc", value: (r) => r.orderCode },
    { header: "Ngày tạo", value: (r) => toDate(r.createdAt), format: "datetime", width: 17 },
    { header: "Khách hàng", value: (r) => r.customerName || "" },
    { header: "SĐT", value: (r) => r.customerPhone || "" },
    { header: "Loại", value: (r) => (r.type === "EXCHANGE" ? "Đổi hàng" : "Trả hàng") },
    { header: "Tiền hàng trả", value: (r) => Number(r.returnTotal) || 0, format: "money", total: true },
    { header: "Tiền hàng đổi", value: (r) => Number(r.exchangeTotal) || 0, format: "money", total: true },
    {
      header: "Chênh lệch (+ thu thêm / − hoàn khách)",
      value: (r) => Number(r.netDifference) || 0,
      format: "money",
      total: true,
    },
    { header: "Hình thức hoàn/thu", value: (r) => PAYMENT[r.refundMethod] || r.refundMethod || "" },
    { header: "Người thực hiện", value: (r) => r.performedByName || "" },
    { header: "Ghi chú", value: (r) => r.note || "", width: 30 },
  ];
  downloadExcel(excelFileName("PhieuTraDoi"), [
    buildSheet("Tra doi hang", cols, returns, { title: "DANH SÁCH PHIẾU TRẢ / ĐỔI HÀNG" }),
  ]);
}

/* ------------------------------- Danh mục ------------------------------- */

export function exportCategories(categories: Category[]) {
  const cols: ExcelColumn<Category>[] = [
    { header: "STT", value: (_, i) => i + 1, format: "int", width: 6 },
    { header: "Mã Category", value: (c) => c.code },
    { header: "Tên Category", value: (c) => c.name, width: 35 },
    { header: "Số sản phẩm", value: (c) => Number(c.productCount) || 0, format: "int", total: true },
    { header: "Trạng thái", value: (c) => (c.status === "ACTIVE" ? "Đang sử dụng" : "Ngừng sử dụng") },
  ];
  downloadExcel(excelFileName("DanhMuc"), [
    buildSheet("Category", cols, categories, { title: "DANH SÁCH CATEGORY" }),
  ]);
}

/* ------------------------------- Nhân viên ------------------------------- */

export function exportStaff(staff: StaffUser[]) {
  const cols: ExcelColumn<StaffUser>[] = [
    { header: "Mã NV", value: (s) => s.code },
    { header: "Username", value: (s) => s.username },
    { header: "Họ và tên", value: (s) => s.fullName, width: 28 },
    { header: "SĐT", value: (s) => s.phone || "" },
    { header: "Phân quyền", value: (s) => ROLE[s.role] || s.role },
    { header: "Trạng thái", value: (s) => (s.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa") },
    { header: "Ngày tạo", value: (s) => toDate(s.createdAt), format: "datetime", width: 17 },
  ];
  // Không xuất mật khẩu / token — chỉ thông tin hiển thị trên CMS
  downloadExcel(excelFileName("NhanVien"), [
    buildSheet("Nhan vien", cols, staff, { title: "DANH SÁCH NHÂN VIÊN" }),
  ]);
}

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
