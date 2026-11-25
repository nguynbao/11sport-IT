import type { Order, ReturnReceipt } from "@/shared/types";
import { formatVariantLabel } from "@/shared/utils/format";
import { PAYMENT_LABELS as PAYMENT } from "@/shared/lib/exportLabels";
import { buildSheet, downloadExcel, excelFileName, ExcelColumn, toDate } from "@/shared/lib/excel";

const ORDER_STATUS: Record<string, string> = {
  DRAFT: "Bản nháp",
  PAID: "Đã bán",
  PARTIALLY_RETURNED: "Trả 1 phần",
  FULLY_RETURNED: "Trả toàn bộ",
};

/* -------------------------------- Đơn hàng -------------------------------- */

const formatOrderItemsDetail = (o: Order): string => {
  if (!Array.isArray(o.items) || o.items.length === 0) return "";
  return o.items
    .map((it, idx) => {
      const variant = formatVariantLabel(it.color, it.size);
      const variantPart = variant && variant !== "Mặc định" ? ` [${variant}]` : "";
      const giftTag = it.isGift || it.discountType === "GIFT" ? " (Hàng tặng)" : "";
      const qty = Number(it.quantity) || 0;
      const lineTotal =
        Number(it.lineTotal) || (Number(it.unitPrice) || 0) * qty;
      const returnedPart =
        Number(it.returnedQuantity) > 0 ? ` (Đã trả: ${it.returnedQuantity})` : "";
      const prefix = o.items.length > 1 ? `${idx + 1}. ` : "";
      return `${prefix}${it.productCode ? `[${it.productCode}] ` : ""}${it.productName}${variantPart}${giftTag} x${qty} (${lineTotal.toLocaleString("vi-VN")}đ)${returnedPart}`;
    })
    .join("\n");
};

export function exportOrders(orders: Order[]) {
  const orderCols: ExcelColumn<Order>[] = [
    { header: "Mã đơn", value: (o) => o.orderCode || o.code || o._id },
    { header: "Ngày bán", value: (o) => toDate(o.createdAt), format: "datetime", width: 17 },
    { header: "Khách hàng", value: (o) => o.customerName },
    { header: "SĐT", value: (o) => o.customerPhone },
    {
      header: "Thanh toán",
      value: (o) =>
        o.paymentMethod === "OTHER" && o.paymentMethodDetail
          ? `Khác (${o.paymentMethodDetail})`
          : PAYMENT[o.paymentMethod] || o.paymentMethod,
    },
    {
      header: "Số SP",
      value: (o) => (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
      format: "int",
      total: true,
    },
    {
      header: "Chi tiết đơn hàng",
      value: formatOrderItemsDetail,
      width: 60,
    },
    { header: "Tiền hàng (niêm yết)", value: (o) => Number(o.rawSubtotal || o.subtotal) || 0, format: "money", total: true },
    { header: "Giảm giá SP", value: (o) => Number(o.itemDiscountTotal) || 0, format: "money", total: true },
    { header: "Giảm giá Bill", value: (o) => Number(o.billDiscountAmount) || 0, format: "money", total: true },
    { header: "Phí thẻ", value: (o) => Number(o.cardFee) || 0, format: "money", total: true },
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
    {
      header: "Tên sản phẩm",
      value: (l) =>
        l.item.isGift || l.item.discountType === "GIFT"
          ? `${l.item.productName} (Hàng tặng)`
          : l.item.productName,
      width: 42,
    },
    { header: "Phân loại (Màu - Size)", value: (l) => formatVariantLabel(l.item.color, l.item.size), width: 18 },
    { header: "ĐVT", value: (l) => l.item.unit, width: 8 },
    { header: "Đơn giá", value: (l) => Number(l.item.originalUnitPrice || l.item.unitPrice) || 0, format: "money" },
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
    {
      header: "Tiền hàng gốc trả",
      value: (r) => Number(r.returnSubtotal ?? (Number(r.returnTotal || 0) - Number(r.refundedCardFee || 0))) || 0,
      format: "money",
      total: true,
    },
    {
      header: "Hoàn phí thẻ",
      value: (r) => Number(r.refundedCardFee) || 0,
      format: "money",
      total: true,
    },
    { header: "Tổng hoàn đơn cũ", value: (r) => Number(r.returnTotal) || 0, format: "money", total: true },
    { header: "Tiền hàng đổi", value: (r) => Number(r.exchangeTotal) || 0, format: "money", total: true },
    {
      header: "Chênh lệch (+ thu thêm / − hoàn khách)",
      value: (r) => Number(r.netDifference) || 0,
      format: "money",
      total: true,
    },
    {
      header: "Cấn trừ công nợ",
      value: (r) => Number(r.debtReduction) || 0,
      format: "money",
      total: true,
    },
    {
      header: "Thực hoàn tiền khách",
      value: (r) =>
        Number(
          r.cashRefund ??
            (Number(r.netDifference) < 0
              ? Math.max(0, Math.abs(Number(r.netDifference)) - Number(r.debtReduction || 0))
              : 0)
        ) || 0,
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

