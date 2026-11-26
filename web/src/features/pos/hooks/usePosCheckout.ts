import { useEffect, useMemo } from "react";
import type { Product, Order, DiscountType } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { cleanPhoneDigits, formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { SPLIT_METHOD_OPTIONS, cartUnitPrice, type PosTabProps } from "../types";
import type { PosStateSlice } from "./usePosState";
import type { PosDraftsSlice } from "./usePosDrafts";
import type { PosCatalogSlice } from "./usePosCatalog";
import type { PosCartSlice } from "./usePosCart";

/** Tổng tiền & tạo đơn */
export function usePosCheckout(s: PosStateSlice & PosDraftsSlice & PosCatalogSlice & PosCartSlice, onOpenInvoice: PosTabProps["onOpenInvoice"]) {
  const {
    cart,
    getItemPricing,
    billDiscountInputMode,
    billCustomPriceText,
    setBillDiscountType,
    setBillDiscountInputMode,
    setBillCustomPriceText,
    setBillDiscountValue,
    setIsManualBillDiscount,
    billDiscountType,
    billDiscountValue,
    paymentMethod,
    cardFeePercent,
    setSplitPayments,
    splitPayments,
    setErrorMsg,
    setSuccessMsg,
    customerPhone,
    customerName,
    giftCart,
    getFloor1Stock,
    setSubmitting,
    debtDueDate,
    note,
    editingServerDraftOrder,
    drafts,
    setShowCheckoutDrawer,
    removeDraft,
    activeDraftId,
    setEditingServerDraftOrder,
    fetchSellableProducts,
    fetchActivePromotions,
    fetchSavedDraftOrders,
  } = s;
  const rawSubtotal = cart.reduce(
    (sum, item) => sum + cartUnitPrice(item) * item.quantity,
    0
  );
  const itemDiscountTotal = cart.reduce(
    (sum, item) => sum + getItemPricing(item).discountAmount,
    0
  );
  const subtotal = cart.reduce(
    (sum, item) => sum + getItemPricing(item).lineTotal,
    0
  );

  // Tự động tính lại giảm giá Bill khi giỏ hàng (subtotal) thay đổi mà nhân viên đang nhập giá Bill mục tiêu (PRICE)
  useEffect(() => {
    if (billDiscountInputMode !== "PRICE" || !billCustomPriceText) return;
    if (subtotal <= 0) {
      setBillDiscountType("NONE");
      setBillDiscountInputMode("NONE");
      setBillCustomPriceText("");
      setBillDiscountValue(0);
      setIsManualBillDiscount(false);
      return;
    }
    const rawTarget = parseNumberDots(billCustomPriceText);
    const clampedTarget = Math.min(subtotal, Math.max(0, rawTarget));
    const recomputedDiscount = Math.max(0, subtotal - clampedTarget);
    const nextType: DiscountType = recomputedDiscount > 0 ? "AMOUNT" : "NONE";
    const formattedTarget = formatNumberDots(clampedTarget);

    if (billDiscountType !== nextType) {
      setBillDiscountType(nextType);
    }
    if (billDiscountValue !== recomputedDiscount) {
      setBillDiscountValue(recomputedDiscount);
    }
    if (billCustomPriceText !== formattedTarget) {
      setBillCustomPriceText(formattedTarget);
    }
  }, [
    subtotal,
    billDiscountInputMode,
    billCustomPriceText,
    billDiscountType,
    billDiscountValue,
  ]);

  const cleanBillDiscountValue =
    billDiscountInputMode === "PRICE" && billCustomPriceText !== ""
      ? Math.max(
          0,
          subtotal - Math.min(subtotal, Math.max(0, parseNumberDots(billCustomPriceText)))
        )
      : billDiscountType === "PERCENT"
        ? Math.min(100, Math.max(0, billDiscountValue))
        : billDiscountType === "AMOUNT"
          ? Math.min(subtotal, Math.max(0, Math.round(billDiscountValue)))
          : 0;

  const billDiscountAmount =
    billDiscountInputMode === "PRICE" && billCustomPriceText !== ""
      ? cleanBillDiscountValue
      : billDiscountType === "PERCENT"
        ? Math.round((subtotal * cleanBillDiscountValue) / 100)
        : billDiscountType === "AMOUNT"
          ? cleanBillDiscountValue
          : 0;

  const afterBillDiscount = Math.max(0, subtotal - billDiscountAmount);
  const cardFee =
    paymentMethod === "CARD" ? Math.round((afterBillDiscount * cardFeePercent) / 100) : 0;
  const totalAmount = afterBillDiscount + cardFee;

  useEffect(() => {
    if (paymentMethod !== "OTHER") return;
    setSplitPayments((prev) => {
      if (!prev.some((s) => s.method === "DEBT")) return prev;
      const nonDebtSum = prev
        .filter((s) => s.method !== "DEBT")
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      const expectedDebt = Math.max(0, totalAmount - nonDebtSum);
      const curDebt = prev.find((s) => s.method === "DEBT")?.amount ?? 0;
      if (curDebt === expectedDebt) return prev;
      return prev.map((s) => (s.method === "DEBT" ? { ...s, amount: expectedDebt } : s));
    });
  }, [totalAmount, paymentMethod]);

  const currentDebtAmount = useMemo(() => {
    if (paymentMethod !== "OTHER") return 0;
    return Math.min(
      totalAmount,
      splitPayments
        .filter((sp) => sp.method === "DEBT")
        .reduce((sum, sp) => sum + Math.max(0, Number(sp.amount) || 0), 0)
    );
  }, [paymentMethod, splitPayments, totalAmount]);

  const currentPaidNowAmount = useMemo(() => {
    if (paymentMethod !== "OTHER") return totalAmount;
    return Math.max(0, totalAmount - currentDebtAmount);
  }, [paymentMethod, totalAmount, currentDebtAmount]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanPhone = cleanPhoneDigits(customerPhone);
    if (!cleanPhone) {
      setErrorMsg("Vui lòng nhập Số điện thoại khách hàng (bắt buộc).");
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg("Vui lòng nhập Tên khách hàng (bắt buộc).");
      return;
    }
    if (cart.length === 0 && giftCart.length === 0) {
      setErrorMsg("Giỏ hàng đang trống. Vui lòng chọn ít nhất 1 sản phẩm.");
      return;
    }

    const combinedQtyByProd = new Map<string, { prod: Product; qty: number }>();
    for (const c of cart) {
      const cur = combinedQtyByProd.get(c.product._id)?.qty || 0;
      combinedQtyByProd.set(c.product._id, { prod: c.product, qty: cur + c.quantity });
    }
    for (const g of giftCart) {
      const cur = combinedQtyByProd.get(g.product._id)?.qty || 0;
      combinedQtyByProd.set(g.product._id, { prod: g.product, qty: cur + g.quantity });
    }
    for (const [, entry] of Array.from(combinedQtyByProd.entries())) {
      const f1 = getFloor1Stock(entry.prod);
      if (entry.qty > f1) {
        setErrorMsg(
          `Sản phẩm "${entry.prod.name}" vượt quá tồn Kho Tầng 1 hiện có (${f1} ${entry.prod.unit}).`
        );
        return;
      }
    }

    if (paymentMethod === "OTHER" && splitPayments.length === 0) {
      setErrorMsg("Vui lòng bấm vào ô (+) để chọn hình thức thanh toán.");
      return;
    }

    const formattedSplitDetail =
      paymentMethod === "OTHER"
        ? splitPayments
          .map((sp) => {
            const label =
              SPLIT_METHOD_OPTIONS.find((o) => o.value === sp.method)?.label ||
              sp.method;
            return `${label}: ${formatNumberDots(sp.amount || 0)}`;
          })
          .join(" + ")
        : "";

    setSubmitting(true);
    try {
      const payload = {
        customerPhone: cleanPhone,
        customerName: customerName.trim(),
        paymentMethod,
        paymentMethodDetail: formattedSplitDetail,
        splitPayments: paymentMethod === "OTHER" ? splitPayments : [],
        debtAmount: currentDebtAmount,
        debtDueDate: currentDebtAmount > 0 && debtDueDate ? debtDueDate : null,
        hasCardFee: paymentMethod === "CARD",
        cardFeePercent: paymentMethod === "CARD" ? cardFeePercent : 0,
        billDiscountType: cleanBillDiscountValue > 0 ? billDiscountType : "NONE",
        billDiscountValue: cleanBillDiscountValue,
        note: note.trim() || "Giá đã bao gồm thuế",
        items: [
          ...cart.map((c) => ({
            productId: c.product._id,
            color: c.color || "",
            size: c.size || "",
            quantity: c.quantity,
            isGift: false,
            discountType: c.discountValue > 0 ? c.discountType : "NONE",
            discountValue: c.discountValue,
          })),
          ...giftCart.map((g) => ({
            productId: g.product._id,
            color: g.color || "",
            size: g.size || "",
            quantity: g.quantity,
            isGift: true,
            discountType: "GIFT" as DiscountType,
            discountValue: 100,
          })),
        ],
      };

      const endpoint = editingServerDraftOrder
        ? `/orders/${editingServerDraftOrder._id}/confirm`
        : "/orders";
      const res = await apiRequest<Order>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const createdOrder = res.data;
      const createdMsg = `Tạo đơn hàng ${createdOrder.orderCode || createdOrder.code || ""} thành công!`;
      const hasOtherDrafts = drafts.length > 1;
      setShowCheckoutDrawer(false);
      removeDraft(activeDraftId);
      setSuccessMsg(
        hasOtherDrafts
          ? `${createdMsg} Đã chuyển sang đơn đang chờ tiếp theo.`
          : createdMsg
      );
      setEditingServerDraftOrder(null);
      fetchSellableProducts();
      fetchActivePromotions();
      fetchSavedDraftOrders();
      onOpenInvoice(createdOrder);
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi tạo đơn bán hàng");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    rawSubtotal,
    itemDiscountTotal,
    subtotal,
    cleanBillDiscountValue,
    billDiscountAmount,
    afterBillDiscount,
    cardFee,
    totalAmount,
    currentDebtAmount,
    currentPaidNowAmount,
    handleCreateOrder,
  };
}

export type PosCheckoutSlice = ReturnType<typeof usePosCheckout>;
