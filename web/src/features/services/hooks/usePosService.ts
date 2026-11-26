import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type {
  ServiceType,
  ServiceOrder,
  ServicePaymentMethod,
  ServiceDiscountType,
  ServiceOrdersMeta,
} from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { cleanPhoneDigits, parseNumberDots } from "@/shared/utils/format";
import { useDebounce } from "@/shared/hooks/useDebounce";
import {
  type ServiceDiscountMode,
  type ServiceCartLine,
  type PaymentTimingMode,
  computeServiceLinePricing,
  getTodayStr,
} from "../types";

export function usePosService({
  onMetaChange,
}: {
  onMetaChange?: (meta: ServiceOrdersMeta) => void;
}) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  // Giỏ dịch vụ đang tạo
  const [serviceCart, setServiceCart] = useState<ServiceCartLine[]>([]);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);

  const [receivedDate, setReceivedDate] = useState<string>(getTodayStr());
  const [dueDate, setDueDate] = useState<string>("");
  const [dueDaysInput, setDueDaysInput] = useState<string>("");
  const [billDiscountMode, setBillDiscountMode] = useState<ServiceDiscountMode>("NONE");
  const [billDiscountInput, setBillDiscountInput] = useState<string>("");
  const [paymentTiming, setPaymentTiming] = useState<PaymentTimingMode>("LATER");
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<ServicePaymentMethod>("CASH");
  const [cardFeePercent, setCardFeePercent] = useState<number>(1.8);
  const [leftView, setLeftView] = useState<"COMPOSE" | "ORDERS">("COMPOSE");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Danh sách đơn dịch vụ
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [ordersMeta, setOrdersMeta] = useState<ServiceOrdersMeta>({
    totalOrders: 0,
    receivedCount: 0,
    inProgressCount: 0,
    readyCount: 0,
    returnedCount: 0,
    overdueCount: 0,
    unpaidCount: 0,
    totalRevenue: 0,
    totalPaid: 0,
    totalRemaining: 0,
  });
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const debouncedSearch = useDebounce(orderSearch, 250);
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE_ONLY");

  // Modal xác nhận thu tiền & trả đồ khi đơn đã làm xong (READY)
  const [collectModalOrder, setCollectModalOrder] = useState<ServiceOrder | null>(null);
  const [collectAmountInput, setCollectAmountInput] = useState<number>(0);
  const [collectMethod, setCollectMethod] = useState<ServicePaymentMethod>("CASH");
  const [collectCardFeePercent, setCollectCardFeePercent] = useState<number>(1.8);
  const [collectNote, setCollectNote] = useState<string>("");
  const [submittingCollect, setSubmittingCollect] = useState<boolean>(false);

  // Modal in phiếu dịch vụ (In 2 bản: Bản giao khách + Bản lưu shop, khổ K80)
  const [printOrder, setPrintOrder] = useState<ServiceOrder | null>(null);
  const servicePrintRef = useRef<HTMLDivElement>(null);

  const handlePrintServiceReceipt = (
    mode: "SPLIT_2_BILLS" | "BOTH_2_PAGES" | "COPY_1" | "COPY_2" = "SPLIT_2_BILLS"
  ) => {
    if (!servicePrintRef.current || !printOrder) return;
    const copyNodes = servicePrintRef.current.querySelectorAll(".service-bill-copy");
    const copy1Html = copyNodes[0]?.outerHTML || "";
    const copy2Html = copyNodes[1]?.outerHTML || "";
    if (!copy1Html && !copy2Html) return;

    const printWindow = window.open("", "_blank", "width=900,height=800");
    if (!printWindow) {
      window.print();
      return;
    }

    const originUrl = typeof window !== "undefined" ? window.location.origin : "";
    const effectiveMode = mode;

    const initialStep =
      effectiveMode === "SPLIT_2_BILLS" || effectiveMode === "COPY_1"
        ? "1"
        : effectiveMode === "COPY_2"
          ? "2"
          : "all";

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <base href="${originUrl}/" />
          <title>Hóa đơn dịch vụ ${printOrder.orderCode} - ${initialStep === "1"
        ? "Liên 1 (Giao Khách)"
        : initialStep === "2"
          ? "Liên 2 (Lưu Shop)"
          : "2 Bản"
      }</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page {
              margin: 2mm;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #000000;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .service-print-page {
              width: 74mm;
              max-width: 74mm;
              margin: 0 auto;
              box-sizing: border-box;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .service-bill-copy {
              border: none !important;
              box-shadow: none !important;
              margin: 0 !important;
            }
            /* Chế độ in tách riêng từng bill (ép máy in nhiệt K80 cắt rời từng bill) */
            body[data-print-step="1"] .bill-page-1 {
              display: block !important;
            }
            body[data-print-step="1"] .bill-page-2 {
              display: none !important;
            }
            body[data-print-step="2"] .bill-page-1 {
              display: none !important;
            }
            body[data-print-step="2"] .bill-page-2 {
              display: block !important;
            }
            /* Chế độ in gộp 2 trang (tách trang chuẩn CSS Paged Media) */
            body[data-print-step="all"] .bill-page-1 {
              display: block !important;
              page-break-after: always !important;
              break-after: page !important;
            }
            body[data-print-step="all"] .bill-page-2 {
              display: block !important;
              page-break-before: always !important;
              break-before: page !important;
              margin-top: 0 !important;
            }
          </style>
        </head>
        <body data-print-step="${initialStep}">
          <div class="service-print-page bill-page-1">
            ${copy1Html}
          </div>
          <div class="service-print-page bill-page-2">
            ${copy2Html}
          </div>
          <script>
            (function() {
              var mode = ${JSON.stringify(effectiveMode)};
              var orderCode = ${JSON.stringify(printOrder.orderCode)};
              var step2Started = false;

              function finishAndClose() {
                setTimeout(function() {
                  window.close();
                }, 300);
              }

              function triggerSecondBillPrint() {
                if (step2Started) return;
                step2Started = true;
                document.body.setAttribute("data-print-step", "2");
                document.title = "Hóa đơn dịch vụ " + orderCode + " - Liên 2 (Lưu Shop)";
                setTimeout(function() {
                  window.focus();
                  window.onafterprint = finishAndClose;
                  window.print();
                  finishAndClose();
                }, 450);
              }

              window.onload = function() {
                setTimeout(function() {
                  window.focus();
                  if (mode === "SPLIT_2_BILLS") {
                    window.onafterprint = triggerSecondBillPrint;
                    window.print();
                    triggerSecondBillPrint();
                  } else {
                    window.onafterprint = finishAndClose;
                    window.print();
                    finishAndClose();
                  }
                }, 350);
              };
            })();
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const fetchServiceTypes = useCallback(async () => {
    setLoadingTypes(true);
    try {
      const res = await apiRequest<ServiceType[]>("/service-types?status=ACTIVE");
      setServiceTypes(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoadingTypes(false);
    }
  }, []);

  const fetchServiceOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      if (
        statusFilter !== "ALL" &&
        statusFilter !== "ACTIVE_ONLY" &&
        statusFilter !== "OVERDUE"
      ) {
        params.set("status", statusFilter);
      }
      if (statusFilter === "OVERDUE") {
        params.set("overdueOnly", "true");
      }
      const qs = params.toString();
      const res = await apiRequest<ServiceOrder[]>(
        `/service-orders${qs ? `?${qs}` : ""}`
      );
      setServiceOrders(res.data || []);
      if (res.meta) {
        const m = res.meta as unknown as ServiceOrdersMeta;
        setOrdersMeta(m);
        onMetaChange?.(m);
      }
    } catch {
      // ignore
    } finally {
      setLoadingOrders(false);
    }
  }, [debouncedSearch, statusFilter, onMetaChange]);

  useEffect(() => {
    fetchServiceTypes();
  }, [fetchServiceTypes]);

  useEffect(() => {
    fetchServiceOrders();
  }, [fetchServiceOrders]);

  // Tự động tra cứu khách hàng khi nhập SĐT
  const debouncedPhone = useDebounce(customerPhone, 300);
  useEffect(() => {
    const digits = cleanPhoneDigits(debouncedPhone);
    if (digits.length < 9) {
      setIsExistingCustomer(false);
      return;
    }
    let cancelled = false;
    setLookingUpCustomer(true);
    apiRequest<{
      found: boolean;
      customer: { _id: string; name: string; phone: string } | null;
    }>(`/customers/lookup?phone=${encodeURIComponent(digits)}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.found && res.data.customer) {
          setIsExistingCustomer(true);
          setCustomerName((prev) => prev.trim() || res.data.customer!.name || "");
        } else {
          setIsExistingCustomer(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsExistingCustomer(false);
      })
      .finally(() => {
        if (!cancelled) setLookingUpCustomer(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedPhone]);

  const handleAddServiceType = (st: ServiceType) => {
    setErrorMsg("");
    setServiceCart((prev) => [
      ...prev,
      {
        key: `${st._id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        serviceTypeId: st._id,
        serviceCode: st.code,
        serviceName: st.name,
        unit: st.unit || "Cây",
        defaultPrice: st.defaultPrice,
        unitPrice: st.defaultPrice,
        quantity: 1,
        discountMode: "NONE",
        discountInput: "",
        itemNote: "",
      },
    ]);
  };

  const handleUpdateLine = (
    key: string,
    patch: Partial<
      Pick<
        ServiceCartLine,
        "unitPrice" | "quantity" | "discountMode" | "discountInput" | "itemNote"
      >
    >
  ) => {
    setServiceCart((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  const handleRemoveLine = (key: string) => {
    setServiceCart((prev) => prev.filter((l) => l.key !== key));
  };

  const {
    rawSubtotal,
    itemDiscountTotal,
    subtotal,
    billDiscountType,
    billDiscountValue,
    billDiscountAmount,
    afterBillDiscount,
    cardFee,
    totalAmount,
  } = useMemo(() => {
    let raw = 0;
    let itemDisc = 0;
    let sub = 0;
    for (const item of serviceCart) {
      const p = computeServiceLinePricing(item);
      raw += p.grossLine;
      itemDisc += p.discountAmount;
      sub += p.lineTotal;
    }

    let bType: ServiceDiscountType = "NONE";
    let bVal = 0;
    let bAmt = 0;
    if (billDiscountMode === "PERCENT") {
      const pct = Math.min(100, Math.max(0, Number(billDiscountInput) || 0));
      bAmt = Math.round((sub * pct) / 100);
      bType = pct > 0 ? "PERCENT" : "NONE";
      bVal = pct;
    } else if (billDiscountMode === "AMOUNT") {
      const amt = Math.min(sub, parseNumberDots(billDiscountInput));
      bAmt = amt;
      bType = amt > 0 ? "AMOUNT" : "NONE";
      bVal = amt;
    } else if (billDiscountMode === "PRICE") {
      const desired =
        billDiscountInput.trim() === ""
          ? sub
          : Math.min(sub, parseNumberDots(billDiscountInput));
      bAmt = Math.max(0, sub - desired);
      bType = bAmt > 0 ? "AMOUNT" : "NONE";
      bVal = bAmt;
    }

    const afterBill = Math.max(0, sub - bAmt);
    const pctCard = cardFeePercent === 4 ? 4 : 1.8;
    const fee =
      paymentMethod === "CARD"
        ? Math.round((afterBill * pctCard) / 100)
        : 0;
    const total = afterBill + fee;

    return {
      rawSubtotal: raw,
      itemDiscountTotal: itemDisc,
      subtotal: sub,
      billDiscountType: bType,
      billDiscountValue: bVal,
      billDiscountAmount: bAmt,
      afterBillDiscount: afterBill,
      cardFee: fee,
      totalAmount: total,
    };
  }, [
    serviceCart,
    billDiscountMode,
    billDiscountInput,
    paymentMethod,
    cardFeePercent,
  ]);

  const computedPaidAmount = useMemo(() => {
    if (paymentTiming === "FULL") return totalAmount;
    if (paymentTiming === "LATER") return 0;
    return Math.min(totalAmount, Math.max(0, depositAmount));
  }, [paymentTiming, totalAmount, depositAmount]);

  const computedRemainingAmount = Math.max(0, totalAmount - computedPaidAmount);

  const handleSelectPaymentMethod = (pm: ServicePaymentMethod) => {
    setPaymentMethod(pm);
  };

  const handleCreateServiceOrder = async (e: React.FormEvent) => {
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
    if (!receivedDate) {
      setErrorMsg("Vui lòng chọn Ngày gửi.");
      return;
    }
    if (!dueDate) {
      setErrorMsg("Vui lòng chọn Ngày hẹn trả khách.");
      return;
    }
    if (serviceCart.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 dịch vụ.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
        receivedAt: receivedDate,
        dueAt: dueDate,
        items: serviceCart.map((l) => {
          const p = computeServiceLinePricing(l);
          return {
            serviceTypeId: l.serviceTypeId,
            serviceCode: l.serviceCode,
            serviceName: l.serviceName,
            unit: l.unit,
            defaultPrice: l.defaultPrice,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            discountType: p.discountType,
            discountValue: p.discountValue,
            discountAmount: p.discountAmount,
            itemNote: l.itemNote.trim(),
          };
        }),
        billDiscountType,
        billDiscountValue,
        hasCardFee: paymentMethod === "CARD",
        cardFeePercent: paymentMethod === "CARD" ? (cardFeePercent === 4 ? 4 : 1.8) : 0,
        paidAmount: computedPaidAmount,
        paymentMethod,
        note: note.trim(),
      };

      const res = await apiRequest<ServiceOrder>("/service-orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const created = res.data;
      setSuccessMsg(
        `Đã tạo phiếu dịch vụ ${created.orderCode} cho khách ${created.customerName}!`
      );
      setServiceCart([]);
      setCustomerPhone("");
      setCustomerName("");
      setIsExistingCustomer(false);
      setReceivedDate(getTodayStr());
      setDueDate("");
      setDueDaysInput("");
      setBillDiscountMode("NONE");
      setBillDiscountInput("");
      setPaymentTiming("LATER");
      setDepositAmount(0);
      setPaymentMethod("CASH");
      setCardFeePercent(1.8);
      setNote("");
      fetchServiceOrders();
      setPrintOrder(created);
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tạo phiếu dịch vụ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCollectReadyOrder = (order: ServiceOrder) => {
    setCollectModalOrder(order);
    setCollectAmountInput(order.remainingAmount);
    setCollectMethod(order.paymentMethod || "CASH");
    setCollectCardFeePercent(order.cardFeePercent === 4 ? 4 : 1.8);
    setCollectNote("Thu tiền & trả đồ khi đơn đã làm xong");
  };

  const handleConfirmReturnPaidReadyOrder = async (order: ServiceOrder) => {
    setSubmittingCollect(true);
    setErrorMsg("");
    try {
      await apiRequest(`/service-orders/${order._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "RETURNED" }),
      });
      setSuccessMsg(`Đã xác nhận trả đồ cho đơn ${order.orderCode}!`);
      fetchServiceOrders();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể xác nhận trả đồ");
    } finally {
      setSubmittingCollect(false);
    }
  };

  const handleConfirmCollectAndReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectModalOrder) return;
    setSubmittingCollect(true);
    setErrorMsg("");
    try {
      const useCardFee = collectMethod === "CARD";
      const pct = useCardFee ? (collectCardFeePercent === 4 ? 4 : 1.8) : 0;
      await apiRequest(`/service-orders/${collectModalOrder._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "RETURNED",
          collectAmount: collectAmountInput,
          paymentMethod: collectMethod,
          hasCardFee: useCardFee,
          cardFeePercent: pct,
          paymentNote:
            collectNote.trim() || "Sales xác nhận thu tiền & trả đồ khi đơn đã xong",
        }),
      });
      setSuccessMsg(
        `Đã xác nhận thu tiền & trả đồ cho đơn ${collectModalOrder.orderCode}!`
      );
      setCollectModalOrder(null);
      fetchServiceOrders();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể xác nhận thu tiền");
    } finally {
      setSubmittingCollect(false);
    }
  };

  const displayedOrders = useMemo(() => {
    if (statusFilter === "ACTIVE_ONLY") {
      return serviceOrders.filter(
        (o) =>
          o.status === "RECEIVED" ||
          o.status === "IN_PROGRESS" ||
          o.status === "READY"
      );
    }
    return serviceOrders;
  }, [serviceOrders, statusFilter]);


  return {
    serviceTypes,
    loadingTypes,
    serviceCart,
    setServiceCart,
    customerPhone,
    setCustomerPhone,
    customerName,
    setCustomerName,
    isExistingCustomer,
    setIsExistingCustomer,
    lookingUpCustomer,
    receivedDate,
    setReceivedDate,
    dueDate,
    setDueDate,
    dueDaysInput,
    setDueDaysInput,
    billDiscountMode,
    setBillDiscountMode,
    billDiscountInput,
    setBillDiscountInput,
    paymentTiming,
    setPaymentTiming,
    depositAmount,
    setDepositAmount,
    paymentMethod,
    cardFeePercent,
    setCardFeePercent,
    leftView,
    setLeftView,
    note,
    setNote,
    submitting,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    serviceOrders,
    ordersMeta,
    loadingOrders,
    orderSearch,
    setOrderSearch,
    statusFilter,
    setStatusFilter,
    collectModalOrder,
    setCollectModalOrder,
    collectAmountInput,
    setCollectAmountInput,
    collectMethod,
    setCollectMethod,
    collectCardFeePercent,
    setCollectCardFeePercent,
    collectNote,
    setCollectNote,
    submittingCollect,
    printOrder,
    setPrintOrder,
    servicePrintRef,
    handlePrintServiceReceipt,
    fetchServiceTypes,
    fetchServiceOrders,
    handleAddServiceType,
    handleUpdateLine,
    handleRemoveLine,
    rawSubtotal,
    itemDiscountTotal,
    subtotal,
    billDiscountType,
    billDiscountValue,
    billDiscountAmount,
    afterBillDiscount,
    cardFee,
    totalAmount,
    computedPaidAmount,
    computedRemainingAmount,
    handleSelectPaymentMethod,
    handleCreateServiceOrder,
    handleOpenCollectReadyOrder,
    handleConfirmReturnPaidReadyOrder,
    handleConfirmCollectAndReturn,
    displayedOrders,
  };
}
