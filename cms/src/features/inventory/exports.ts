import type { InventoryReportRow, Product, ProductVariant, StockMovement } from "@/shared/types";
import { variantEffectiveCostPrice, variantEffectiveSellingPrice } from "@/shared/utils/productCode";
import { formatVariantLabel } from "@/shared/utils/format";
import { ROLE_LABELS as ROLE } from "@/shared/lib/exportLabels";
import { buildSheet, downloadExcel, excelFileName, ExcelColumn, toDate } from "@/shared/lib/excel";

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

const categoryNameOf = (p: Product) =>
  p.categoryName || (typeof p.categoryId === "object" ? p.categoryId?.name : "") || "";

const variantsSummaryOf = (p: Product) => {
  if (!Array.isArray(p.variants) || p.variants.length === 0) return "Mặc định";
  return p.variants
    .map((v) => {
      const label = [v.color, v.size ? `Size ${v.size}` : ""].filter(Boolean).join(" - ") || "Mặc định";
      return `${label}: ${v.stock} (T1:${v.stockFloor1}/T2:${v.stockFloor2})`;
    })
    .join(" | ");
};

/* ------------------------------- Sản phẩm ------------------------------- */

/** Giá trị tồn theo giá vốn: cộng theo từng biến thể (giá vốn riêng nếu có) — R8 */
const stockCostValueOf = (p: Product) => {
  const vars = Array.isArray(p.variants) ? p.variants : [];
  if (vars.length === 0) return (Number(p.costPrice) || 0) * (Number(p.stock) || 0);
  return vars.reduce((s, v) => s + variantEffectiveCostPrice(p, v) * (Number(v.stock) || 0), 0);
};
const stockSellValueOf = (p: Product) => {
  const vars = Array.isArray(p.variants) ? p.variants : [];
  if (vars.length === 0) return (Number(p.sellingPrice) || 0) * (Number(p.stock) || 0);
  return vars.reduce((s, v) => s + variantEffectiveSellingPrice(p, v) * (Number(v.stock) || 0), 0);
};

export function exportProducts(products: Product[], opts: { hideCost?: boolean } = {}) {
  const cols: ExcelColumn<Product>[] = [
    { header: "STT", value: (_, i) => i + 1, format: "int", width: 6 },
    { header: "Mã hàng (Chung)", value: (p) => p.code },
    { header: "Mã cũ", value: (p) => p.legacyCode || "", width: 16 },
    { header: "Tên sản phẩm", value: (p) => p.name, width: 42 },
    { header: "Hãng", value: (p) => p.brandName || p.brand || "", width: 14 },
    { header: "Mã hãng", value: (p) => p.brandCode || "", width: 9 },
    { header: "Version", value: (p) => p.versionName || "", width: 20 },
    { header: "Mã version", value: (p) => p.versionCode || "", width: 10 },
    { header: "Chi tiết Màu - Size & Tồn", value: variantsSummaryOf, width: 45 },
    { header: "Category", value: categoryNameOf },
    { header: "ĐVT", value: (p) => p.unit, width: 8 },
    { header: "Tồn Kho Tầng 1", value: (p) => Number(p.stockFloor1 ?? p.stock) || 0, format: "int", total: true },
    { header: "Tồn Kho Tầng 2", value: (p) => Number(p.stockFloor2) || 0, format: "int", total: true },
    { header: "Tổng tồn 2 kho", value: (p) => Number(p.stock) || 0, format: "int", total: true },
    { header: "Giá vốn", value: (p) => Number(p.costPrice) || 0, format: "money" },
    { header: "Giá niêm yết", value: (p) => Number(p.sellingPrice) || 0, format: "money" },
    {
      header: "Lãi gộp / SP",
      value: (p) => (p.sellingPrice > 0 && Number(p.costPrice) > 0 ? p.sellingPrice - Number(p.costPrice) : null),
      format: "money",
    },
    {
      header: "Giá trị tồn (giá vốn)",
      value: (p) => stockCostValueOf(p),
      format: "money",
      total: true,
    },
    {
      header: "Giá trị tồn (giá niêm yết)",
      value: (p) => stockSellValueOf(p),
      format: "money",
      total: true,
    },
    { header: "Trạng thái bán", value: (p) => (p.sellingPrice > 0 ? "Đang bán" : "Chưa có giá niêm yết") },
    { header: "Ghi chú", value: (p) => p.note || "", width: 32 },
  ];
  type VariantRow = { p: Product; v: ProductVariant };
  const variantRows: VariantRow[] = products.flatMap((p) =>
    (Array.isArray(p.variants) ? p.variants : []).filter((v) => v.color || v.size).map((v) => ({ p, v }))
  );
  const vCols: ExcelColumn<VariantRow>[] = [
    { header: "STT", value: (_, i) => i + 1, format: "int", width: 6 },
    { header: "Mã con (SKU)", value: (r) => r.v.variantCode || r.v.barcode || "", width: 20 },
    { header: "Mã gốc", value: (r) => r.p.code, width: 14 },
    { header: "Tên sản phẩm", value: (r) => r.p.name, width: 36 },
    { header: "Màu", value: (r) => r.v.color || "", width: 14 },
    { header: "Mã màu", value: (r) => r.v.colorCode || "", width: 8 },
    { header: "Size", value: (r) => r.v.size || "", width: 8 },
    { header: "Tồn Tầng 1", value: (r) => Number(r.v.stockFloor1) || 0, format: "int", total: true },
    { header: "Tồn Tầng 2", value: (r) => Number(r.v.stockFloor2) || 0, format: "int", total: true },
    { header: "Tổng tồn", value: (r) => Number(r.v.stock) || 0, format: "int", total: true },
    { header: "Giá niêm yết riêng", value: (r) => (Number(r.v.sellingPrice) > 0 ? Number(r.v.sellingPrice) : null), format: "money" },
    { header: "Giá niêm yết hiệu lực", value: (r) => variantEffectiveSellingPrice(r.p, r.v), format: "money" },
    { header: "Giá vốn riêng", value: (r) => (Number(r.v.costPrice) > 0 ? Number(r.v.costPrice) : null), format: "money" },
    { header: "Giá vốn hiệu lực", value: (r) => variantEffectiveCostPrice(r.p, r.v), format: "money" },
    { header: "Mã con cũ", value: (r) => r.v.legacyVariantCode || "", width: 22 },
  ];
  const costHeaders = new Set(["Giá vốn", "Lãi gộp / SP", "Giá trị tồn (giá vốn)", "Giá vốn riêng", "Giá vốn hiệu lực"]);
  const finalCols = opts.hideCost ? cols.filter((c) => !costHeaders.has(c.header)) : cols;
  const finalVCols = opts.hideCost ? vCols.filter((c) => !costHeaders.has(c.header)) : vCols;
  const sheets = [
    buildSheet("San pham", finalCols, products, { title: "DANH MỤC SẢN PHẨM & TỒN KHO (TẦNG 1 & TẦNG 2)" }),
  ];
  if (variantRows.length > 0) {
    sheets.push(buildSheet("Bien the", finalVCols, variantRows, { title: "BIẾN THỂ (MÀU/SIZE) — MÃ CON & GIÁ RIÊNG" }));
  }
  downloadExcel(excelFileName("SanPham_TonKho"), sheets);
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
    { header: "Giá vốn (VND)", value: (r) => Number(r.costPrice) || 0, format: "money" },
    { header: "Giá niêm yết (VND)", value: (r) => Number(r.sellingPrice) || 0, format: "money" },
    {
      header: "Giá trị tồn cuối (giá vốn)",
      value: (r) => (Number(r.costPrice) || 0) * (Number(r.closingStock) || 0),
      format: "money",
      total: true,
    },
    {
      header: "Giá trị tồn cuối (giá niêm yết)",
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
    { header: "Tên sản phẩm", value: (m) => m.productName, width: 42 },
    { header: "Phân loại (Màu - Size)", value: (m) => formatVariantLabel(m.color, m.size), width: 18 },
    { header: "Số lượng biến động", value: (m) => m.quantityChange, format: "int" },
    { header: "Tồn trước GD", value: (m) => (m as any).balanceBefore ?? null, format: "int" },
    { header: "Số lượng tồn sau GD", value: (m) => m.balanceAfter, format: "int" },
    { header: "Giá vốn (VND)", value: (m) => Number(m.costPrice) || 0, format: "money" },
    { header: "Giá niêm yết (VND)", value: (m) => Number(m.sellingPrice) || 0, format: "money" },
    { header: "Chứng từ", value: (m) => m.referenceCode || "" },
    { header: "Người thực hiện", value: (m) => m.performedByName || "" },
    {
      header: "Vai trò người thực hiện",
      value: (m) => ROLE[String(m.performedByRole || "").toUpperCase()] || m.performedByRole || "",
    },
    { header: "Ghi chú", value: (m) => m.note || "", width: 40 },
  ];
  downloadExcel(excelFileName("SoKho"), [
    buildSheet("So kho", cols, movements, {
      title: `SỔ KHO${typeFilter ? ` — ${MOVEMENT_LABEL[typeFilter] || typeFilter}` : ""}`,
    }),
  ]);
}

/* ----------------------------- Phiếu nhập kho ----------------------------- */

const checkersOf = (items: any[]) => {
  const byName = new Map<string, number>();
  items.forEach((it) =>
    (it.scanCounts || []).forEach((s: any) =>
      byName.set(s.name, (byName.get(s.name) || 0) + (Number(s.quantity) || 0))
    )
  );
  if (byName.size > 0) {
    return Array.from(byName.entries())
      .map(([n, q]) => `${n} (${q})`)
      .join(", ");
  }
  const fallbackNames = Array.from(
    new Set(items.map((it) => String(it?.checkedByName || "").trim()).filter(Boolean))
  );
  return fallbackNames.join(", ");
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
    { header: "Tổng giá vốn", value: receiptCostTotal, format: "money", total: true },
    { header: "Ghi chú", value: (r) => r.note || "", width: 40 },
    { header: "Người lập", value: (r) => r.createdByName || "" },
    {
      header: "Vai trò người lập",
      value: (r) => ROLE[String(r.createdByRole || "").toUpperCase()] || r.createdByRole || "",
    },
    { header: "Người kiểm (chiếc)", value: (r) => checkersOf(r.items || []), width: 30 },
    { header: "Người hoàn thành", value: (r) => r.completedByName || "" },
    {
      header: "Vai trò người hoàn thành",
      value: (r) => ROLE[String(r.completedByRole || "").toUpperCase()] || r.completedByRole || "",
    },
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
    { header: "Tên hàng", value: (l) => l.item.productName, width: 42 },
    { header: "Màu sắc", value: (l) => l.item.color || "", width: 12 },
    { header: "Size", value: (l) => l.item.size || "", width: 8 },
    { header: "ĐVT", value: (l) => l.item.unit, width: 8 },
    { header: "SL dự kiến", value: (l) => Number(l.item.expectedQuantity) || 0, format: "int", total: true },
    { header: "SL thực nhận", value: (l) => Number(l.item.actualQuantity) || 0, format: "int", total: true },
    {
      header: "Chênh lệch",
      value: (l) => (Number(l.item.actualQuantity) || 0) - (Number(l.item.expectedQuantity) || 0),
      format: "int",
    },
    { header: "Giá vốn", value: (l) => Number(l.item.costPrice) || 0, format: "money" },
    {
      header: "Thành tiền (giá vốn)",
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

