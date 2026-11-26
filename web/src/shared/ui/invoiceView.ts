import type { Order } from "@/shared/types";

export function computeInvoiceView(order: Order) {
  const orderCode = order.orderCode || order.code || order._id;
  const sellerName =
    order.soldByName ||
    order.createdByName ||
    (typeof order.soldBy === "string" ? order.soldBy : "Nhân viên 11Sport");

  const effectiveCardFeePercent =
    order.paymentMethod === "CARD"
      ? Number(order.cardFeePercent) > 0
        ? Number(order.cardFeePercent)
        : order.hasCardFee
          ? 1.8
          : 0
      : 0;

  const paymentMethodLabel =
    order.paymentMethod === "CASH"
      ? "Tiền mặt (CASH)"
      : order.paymentMethod === "BANKING"
        ? "Chuyển khoản (BANKING)"
        : order.paymentMethod === "OTHER"
          ? `Khác (${order.paymentMethodDetail || "Tùy chọn"})`
          : effectiveCardFeePercent > 0
            ? `Thẻ (CARD ${effectiveCardFeePercent}%)`
            : "Thẻ (CARD)";

  const getItemCalculatedPricing = (item: Order["items"][number]) => {
    const isGift = Boolean(item.isGift) || item.discountType === "GIFT";
    const qty = Math.max(1, Number(item.quantity) || 1);
    const discAmt = Math.max(0, Number(item.discountAmount) || 0);
    const rawOrigUnit = Number(item.originalUnitPrice) || 0;
    const storedUnit = Number(item.unitPrice) || 0;
    const storedLine = Number(item.lineTotal) || 0;

    // Đơn giá niêm yết trước giảm (hiển thị cột ĐƠN GIÁ):
    // Nếu có giảm giá SP (discAmt > 0), ưu tiên originalUnitPrice (khi > storedUnit);
    // Nếu dữ liệu cũ chỉ có storedUnit là giá sau giảm (rawSubtotal > subtotal), khôi phục đơn giá gốc = storedUnit + discAmt/qty
    const origUnitPrice =
      discAmt > 0
        ? rawOrigUnit > storedUnit
          ? rawOrigUnit
          : storedLine === storedUnit * qty &&
            (Number(order.rawSubtotal) || 0) > (Number(order.subtotal) || 0)
            ? storedUnit + Math.round(discAmt / qty)
            : rawOrigUnit > 0
              ? rawOrigUnit
              : storedUnit
        : rawOrigUnit > 0
          ? rawOrigUnit
          : storedUnit;

    const origLineTotal = origUnitPrice * qty;
    // Thành tiền sau khi trừ giảm giá SP (hiển thị cột THÀNH TIỀN):
    const netLineTotal = Math.max(0, origLineTotal - discAmt);

    return {
      isGift,
      qty,
      discAmt,
      origUnitPrice,
      origLineTotal,
      netLineTotal,
    };
  };

  const calcRawSub =
    (order.items || []).reduce((s, item) => {
      const p = getItemCalculatedPricing(item);
      return p.isGift ? s : s + p.origLineTotal;
    }, 0) ||
    Number(order.rawSubtotal) ||
    Number(order.subtotal) ||
    0;

  const calcItemDisc =
    (order.items || []).reduce((s, item) => {
      const p = getItemCalculatedPricing(item);
      return p.isGift ? s : s + p.discAmt;
    }, 0) ||
    Number(order.itemDiscountTotal) ||
    0;

  const calcSubtotal = Math.max(0, calcRawSub - calcItemDisc);
  const calcBillDisc = Math.max(0, Number(order.billDiscountAmount) || 0);
  const calcAfterBillDisc = Math.max(0, calcSubtotal - calcBillDisc);
  const calcCardFee =
    order.paymentMethod === "CARD" && order.hasCardFee
      ? Number(order.cardFee) || Math.round((calcAfterBillDisc * effectiveCardFeePercent) / 100)
      : 0;
  const calcTotalAmount = calcAfterBillDisc + calcCardFee;

  const pricedItems = (order.items || []).map((item) => ({
    item,
    pricing: getItemCalculatedPricing(item),
  }));
  const paidItems = pricedItems.filter((x) => !x.pricing.isGift);
  const giftItems = pricedItems.filter((x) => x.pricing.isGift);
  const totalGiftQty = giftItems.reduce((sum, g) => sum + g.pricing.qty, 0);

  return {
    orderCode,
    sellerName,
    effectiveCardFeePercent,
    paymentMethodLabel,
    calcRawSub,
    calcItemDisc,
    calcSubtotal,
    calcBillDisc,
    calcAfterBillDisc,
    calcCardFee,
    calcTotalAmount,
    pricedItems,
    paidItems,
    giftItems,
    totalGiftQty,
  };
}
