import type { Product, Order, DiscountType } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { cleanPhoneDigits, formatNumberDots, formatPhone } from "@/shared/utils/format";
import { MAX_DRAFTS, DEFAULT_NOTE, SPLIT_METHOD_OPTIONS, generateDraftId, isDraftEmpty, type GiftCartItem, type PosTabProps, type CartItem, type SplitPaymentItem, type PaymentMethodType, type DraftOrderData, type DraftOrder } from "../types";
import type { PosStateSlice } from "./usePosState";
import type { PosDraftsSlice } from "./usePosDrafts";
import type { PosCatalogSlice } from "./usePosCatalog";
import type { PosCheckoutSlice } from "./usePosCheckout";

/** Đơn nháp trên server */
export function usePosServerDrafts(s: PosStateSlice & PosDraftsSlice & PosCatalogSlice & PosCheckoutSlice, onOpenInvoice: PosTabProps["onOpenInvoice"]) {
  const {
    setErrorMsg,
    setSuccessMsg,
    customerPhone,
    customerName,
    cart,
    giftCart,
    paymentMethod,
    splitPayments,
    setSavingDraft,
    currentDebtAmount,
    debtDueDate,
    cardFeePercent,
    cleanBillDiscountValue,
    billDiscountType,
    note,
    editingServerDraftOrder,
    setShowCheckoutDrawer,
    setEditingServerDraftOrder,
    removeDraft,
    activeDraftId,
    fetchSavedDraftOrders,
    catalogById,
    products,
    getCurrentDraftData,
    liveDrafts,
    setDrafts,
    applyDraftData,
    setActiveDraftId,
    activeDraftIdRef,
    drafts,
    fetchSellableProducts,
  } = s;
  const handleSaveOrderAsDraft = async (e: React.MouseEvent<HTMLButtonElement>) => {
    setErrorMsg("");
    setSuccessMsg("");

    const form = e.currentTarget.form;
    if (form && !form.reportValidity()) {
      return;
    }

    const cleanPhone = cleanPhoneDigits(customerPhone);
    if (!cleanPhone) {
      setErrorMsg("Vui lòng nhập Số điện thoại khách hàng (bắt buộc khi lưu bản nháp).");
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg("Vui lòng nhập Tên khách hàng (bắt buộc khi lưu bản nháp).");
      return;
    }
    if (cart.length === 0 && giftCart.length === 0) {
      setErrorMsg("Giỏ hàng đang trống. Vui lòng chọn ít nhất 1 sản phẩm để lưu nháp.");
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

    setSavingDraft(true);
    try {
      const payload = {
        status: "DRAFT",
        isDraft: true,
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

      const res = editingServerDraftOrder
        ? await apiRequest<Order>(`/orders/${editingServerDraftOrder._id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
        : await apiRequest<Order>("/orders", {
          method: "POST",
          body: JSON.stringify(payload),
        });

      const savedOrder = res.data;
      const code = savedOrder.orderCode || savedOrder.code || "";
      setShowCheckoutDrawer(false);
      setEditingServerDraftOrder(null);
      removeDraft(activeDraftId);
      setSuccessMsg(`Đã lưu bản nháp hóa đơn ${code}`);
      fetchSavedDraftOrders();
      onOpenInvoice(savedOrder);
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi lưu bản nháp hóa đơn");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadServerDraftToPos = (ord: Order) => {
    setErrorMsg("");
    setSuccessMsg("");
    const saleItems: CartItem[] = [];
    const giftItems: GiftCartItem[] = [];

    for (const it of ord.items || []) {
      const prodId = String(it.productId || "");
      const fallbackQty = Math.max(1, Number(it.quantity) || 1);
      const foundProd =
        catalogById.get(prodId) ||
        products.find((p) => p._id === prodId) ||
        ({
          _id: prodId,
          code: it.productCode || "",
          name: it.productName || "Sản phẩm",
          categoryId: "",
          unit: it.unit || "Cái",
          sellingPrice: Number(it.originalUnitPrice ?? it.unitPrice) || 0,
          stockFloor1: fallbackQty,
          stock: fallbackQty,
        } as Product);

      if (it.isGift || it.discountType === "GIFT") {
        giftItems.push({
          product: foundProd,
          color: it.color || "",
          size: it.size || "",
          quantity: Number(it.quantity) || 1,
        });
      } else {
        saleItems.push({
          product: foundProd,
          color: it.color || "",
          size: it.size || "",
          quantity: Number(it.quantity) || 1,
          discountType: (it.discountType as DiscountType) || "NONE",
          discountValue: Number(it.discountValue) || 0,
          isManualDiscount: (Number(it.discountValue) || 0) > 0,
        });
      }
    }

    const draftData: DraftOrderData = {
      cart: saleItems,
      giftCart: giftItems,
      billDiscountType: (ord.billDiscountType as DiscountType) || "NONE",
      billDiscountValue: Number(ord.billDiscountValue) || 0,
      customerPhone: ord.customerPhone ? formatPhone(ord.customerPhone) : "",
      customerName:
        ord.customerName === "Khách lẻ (Bản nháp)" ? "" : ord.customerName || "",
      isExistingCustomer: false,
      customerOrders: [],
      paymentMethod: (ord.paymentMethod as PaymentMethodType) || "CASH",
      splitPayments: Array.isArray(ord.splitPayments)
        ? (ord.splitPayments as SplitPaymentItem[])
        : [],
      debtDueDate: ord.debtDueDate
        ? new Date(ord.debtDueDate).toISOString().slice(0, 10)
        : "",
      hasCardFee: true,
      cardFeePercent: Number(ord.cardFeePercent) === 4 ? 4 : 1.8,
      note: ord.note || DEFAULT_NOTE,
      editingServerDraftOrder: ord,
    };

    const current = getCurrentDraftData();
    const existingTab = liveDrafts.find(
      (d) => d.editingServerDraftOrder?._id === ord._id
    );

    if (existingTab) {
      setDrafts((prev) =>
        prev.map((d) => {
          if (d.id === existingTab.id) return { ...d, ...draftData };
          if (d.id === activeDraftId) return { ...d, ...current };
          return d;
        })
      );
      applyDraftData(draftData);
      setActiveDraftId(existingTab.id);
      activeDraftIdRef.current = existingTab.id;
    } else if (!isDraftEmpty(current) && drafts.length < MAX_DRAFTS) {
      const nextSeq = drafts.reduce((m, d) => Math.max(m, d.seq), 0) + 1;
      const newTab: DraftOrder = {
        id: generateDraftId(),
        seq: nextSeq,
        ...draftData,
      };
      setDrafts((prev) => [
        ...prev.map((d) => (d.id === activeDraftId ? { ...d, ...current } : d)),
        newTab,
      ]);
      applyDraftData(draftData);
      setActiveDraftId(newTab.id);
      activeDraftIdRef.current = newTab.id;
    } else {
      setDrafts((prev) =>
        prev.map((d) => (d.id === activeDraftId ? { ...d, ...draftData } : d))
      );
      applyDraftData(draftData);
    }

    setSuccessMsg(
      `Đang mở bản nháp ${ord.orderCode || ord.code} (Người tạo: ${ord.createdByName || "Nhân viên"}).`
    );
  };

  const handleQuickConfirmServerDraft = async (ord: Order) => {
    const code = ord.orderCode || ord.code || "";
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Xác nhận thanh toán cho bản nháp ${code}?\nHệ thống sẽ thực hiện TRỪ TỒN KHO TẦNG 1 ngay bây giờ.`
      )
    ) {
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await apiRequest<Order>(`/orders/${ord._id}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          customerName: ord.customerName || "Khách lẻ",
          customerPhone: ord.customerPhone || "0000000000",
        }),
      });
      const editingTab = liveDrafts.find(
        (d) => d.editingServerDraftOrder?._id === ord._id
      );
      if (editingTab) {
        removeDraft(editingTab.id);
      } else if (editingServerDraftOrder?._id === ord._id) {
        setEditingServerDraftOrder(null);
      }
      setSuccessMsg(
        `Đã xác nhận thanh toán & trừ kho thành công cho hóa đơn ${code}!`
      );
      fetchSellableProducts();
      fetchSavedDraftOrders();
      onOpenInvoice(res.data);
    } catch (err: any) {
      fetchSellableProducts();
      setErrorMsg(err?.message || "Không thể chốt thanh toán bản nháp");
    }
  };

  const handleDeleteServerDraft = async (ord: Order) => {
    const code = ord.orderCode || ord.code || "";
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Xóa bản nháp hóa đơn ${code}?`)
    ) {
      return;
    }
    setErrorMsg("");
    try {
      await apiRequest(`/orders/${ord._id}`, { method: "DELETE" });
      const editingTab = liveDrafts.find(
        (d) => d.editingServerDraftOrder?._id === ord._id
      );
      if (editingTab) {
        removeDraft(editingTab.id);
      } else if (editingServerDraftOrder?._id === ord._id) {
        setEditingServerDraftOrder(null);
      }
      setSuccessMsg(`Đã xóa bản nháp hóa đơn ${code}.`);
      fetchSavedDraftOrders();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể xóa bản nháp");
    }
  };

  return {
    handleSaveOrderAsDraft,
    handleLoadServerDraftToPos,
    handleQuickConfirmServerDraft,
    handleDeleteServerDraft,
  };
}

export type PosServerDraftsSlice = ReturnType<typeof usePosServerDrafts>;
