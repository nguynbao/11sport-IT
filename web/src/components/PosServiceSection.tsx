"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ServiceType,
  ServiceOrder,
  ServiceOrderStatus,
  ServicePaymentMethod,
  ServiceDiscountType,
  ServiceOrdersMeta,
  apiRequest,
  formatVND,
  formatNumberDots,
  parseNumberDots,
  formatPhone,
  cleanPhoneDigits,
  formatDateTime,
  useDebounce,
} from "@/lib/api";
import {
  Wrench,
  Plus,
  Minus,
  Trash2,
  Search,
  UserCheck,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Banknote,
  Landmark,
  CreditCard,
  Printer,
  RefreshCw,
  Tag,
  Eye,
  Wallet,
  PackageCheck,
  X,
} from "lucide-react";

type ServiceDiscountMode = "NONE" | "PERCENT" | "AMOUNT" | "PRICE";

interface ServiceCartLine {
  key: string;
  serviceTypeId: string;
  serviceCode: string;
  serviceName: string;
  unit: string;
  defaultPrice: number;
  unitPrice: number;
  quantity: number;
  discountMode: ServiceDiscountMode;
  discountInput: string;
  itemNote: string;
}

function computeServiceLinePricing(line: ServiceCartLine): {
  grossLine: number;
  discountType: ServiceDiscountType;
  discountValue: number;
  discountAmount: number;
  lineTotal: number;
} {
  const grossLine = Math.max(0, line.unitPrice) * Math.max(1, line.quantity);
  if (line.discountMode === "PERCENT") {
    const pct = Math.min(100, Math.max(0, Number(line.discountInput) || 0));
    const discountAmount = Math.round((grossLine * pct) / 100);
    return {
      grossLine,
      discountType: pct > 0 ? "PERCENT" : "NONE",
      discountValue: pct,
      discountAmount,
      lineTotal: Math.max(0, grossLine - discountAmount),
    };
  }
  if (line.discountMode === "AMOUNT") {
    const amt = Math.min(grossLine, parseNumberDots(line.discountInput));
    return {
      grossLine,
      discountType: amt > 0 ? "AMOUNT" : "NONE",
      discountValue: amt,
      discountAmount: amt,
      lineTotal: Math.max(0, grossLine - amt),
    };
  }
  if (line.discountMode === "PRICE") {
    const desired =
      line.discountInput.trim() === ""
        ? grossLine
        : Math.min(grossLine, parseNumberDots(line.discountInput));
    const discountAmount = Math.max(0, grossLine - desired);
    return {
      grossLine,
      discountType: discountAmount > 0 ? "AMOUNT" : "NONE",
      discountValue: discountAmount,
      discountAmount,
      lineTotal: desired,
    };
  }
  return {
    grossLine,
    discountType: "NONE",
    discountValue: 0,
    discountAmount: 0,
    lineTotal: grossLine,
  };
}

type PaymentTimingMode = "FULL" | "LATER" | "DEPOSIT";

const STATUS_BADGE_MAP: Record<
  ServiceOrderStatus,
  { label: string; cls: string }
> = {
  RECEIVED: {
    label: "Đã tiếp nhận",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },
  IN_PROGRESS: {
    label: "Đang xử lý",
    cls: "bg-amber-50 text-amber-800 border-amber-300",
  },
  READY: {
    label: "Đã xong (Chờ lấy)",
    cls: "bg-blue-50 text-blue-700 border-blue-300",
  },
  RETURNED: {
    label: "Đã trả khách",
    cls: "bg-slate-100 text-slate-700 border-slate-300",
  },
  CANCELLED: {
    label: "Đã hủy",
    cls: "bg-red-50 text-red-600 border-red-200",
  },
};

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysToDateStr(baseDateStr: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseDateStr.trim());
  const dt = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date();
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function diffDaysStr(fromStr: string, toStr: string): string {
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromStr.trim());
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toStr.trim());
  if (!m1 || !m2) return "";
  const d1 = new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3])).getTime();
  const d2 = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3])).getTime();
  const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? String(diff) : "";
}

function formatShortDate(raw?: string | null): string {
  if (!raw) return "—";
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PosServiceSection({
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-start">
      {/* ==================== CỘT TRÁI (8 CỘT): CHỌN DỊCH VỤ & CHI TIẾT PHIẾU / THEO DÕI ĐƠN ==================== */}
      <div className="lg:col-span-8 bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
        {/* Thanh Header blue-600 đồng bộ với Bán hàng (POS) */}
        <div className="bg-blue-600 text-white px-3.5 pt-2.5 pb-0 flex flex-wrap items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-2 pb-2">
            <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center shadow-xs shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white leading-tight">
                Dịch Vụ (Sửa chữa)
              </h2>
            </div>
          </div>

          <div className="flex items-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setLeftView("COMPOSE")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${leftView === "COMPOSE"
                ? "bg-white text-blue-700 shadow-xs"
                : "bg-blue-700/80 text-white hover:bg-blue-700"
                }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Chọn dịch vụ ({serviceCart.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setLeftView("ORDERS")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${leftView === "ORDERS"
                ? "bg-white text-blue-700 shadow-xs"
                : "bg-blue-700/80 text-white hover:bg-blue-700"
                }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Theo dõi đơn</span>
              {ordersMeta.receivedCount + ordersMeta.inProgressCount + ordersMeta.readyCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${leftView === "ORDERS"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-blue-700"
                    }`}
                >
                  {ordersMeta.receivedCount + ordersMeta.inProgressCount + ordersMeta.readyCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {leftView === "COMPOSE" ? (
          <div className="p-4 space-y-4">
            {/* 1. CHỌN LOẠI DỊCH VỤ */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-900">
                  1. Chọn Loại Dịch Vụ ({serviceTypes.length})
                </label>
                <span className="text-[11px] text-slate-500">
                  Bấm để thêm vào phiếu (sửa giá trực tiếp bên dưới)
                </span>
              </div>

              {loadingTypes ? (
                <div className="text-xs text-slate-500 py-4 text-center">
                  Đang tải danh mục dịch vụ...
                </div>
              ) : serviceTypes.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  Chưa có loại dịch vụ nào hoạt động. Quản lý có thể tạo thêm loại dịch vụ trong trang CMS.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                  {serviceTypes.map((st) => (
                    <button
                      key={st._id}
                      type="button"
                      onClick={() => handleAddServiceType(st)}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/70 transition flex flex-col justify-between group bg-slate-50/70 cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 line-clamp-1">
                          {st.name}
                        </div>
                        {st.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {st.description}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-slate-200/70 flex items-center justify-between">
                        <span className="font-mono text-xs font-extrabold text-blue-700">
                          {formatVND(st.defaultPrice)}/{st.unit || "Cây"}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-blue-600">
                          <Plus className="w-3.5 h-3.5" /> Thêm
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. DANH SÁCH DỊCH VỤ ĐÃ CHỌN & SỬA GIÁ */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-900 mb-2">
                2. Chi tiết dịch vụ &amp; Giá thực tế ({serviceCart.length})
              </label>

              {serviceCart.length === 0 ? (
                <div className="py-10 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-2">
                  <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    Chưa chọn dịch vụ nào trong phiếu
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Hãy bấm vào Loại dịch vụ ở mục 1 phía trên để thêm vào phiếu.
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {serviceCart.map((line, idx) => {
                    const linePricing = computeServiceLinePricing(line);
                    return (
                      <div
                        key={line.key}
                        className="p-3 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-extrabold text-slate-900">
                              #{idx + 1}. {line.serviceName}
                            </span>
                            <span className="ml-2 text-[11px] text-slate-500">
                              (Giá chuẩn: {formatVND(line.defaultPrice)}/{line.unit})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.key)}
                            className="text-red-500 hover:text-red-700 p-1 rounded"
                            title="Xóa dòng dịch vụ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-7">
                            <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                              Đơn giá thực tế (VNĐ) *
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatNumberDots(line.unitPrice)}
                              onChange={(e) =>
                                handleUpdateLine(line.key, {
                                  unitPrice: parseNumberDots(e.target.value),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-sm font-mono font-extrabold text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>

                          <div className="col-span-5">
                            <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                              Số lượng ({line.unit})
                            </label>
                            <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateLine(line.key, {
                                    quantity: Math.max(1, line.quantity - 1),
                                  })
                                }
                                className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="flex-1 text-center font-mono text-xs font-extrabold">
                                {line.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateLine(line.key, {
                                    quantity: line.quantity + 1,
                                  })
                                }
                                className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* GIẢM GIÁ DÒNG DỊCH VỤ */}
                        <div className="pt-1 border-t border-slate-200/70 space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex flex-wrap items-center gap-1">
                              {(
                                [
                                  { id: "NONE", label: "Không giảm" },
                                  { id: "PERCENT", label: "Giảm %" },
                                  { id: "AMOUNT", label: "Giảm tiền" },
                                  { id: "PRICE", label: "Giá thu" },
                                ] as const
                              ).map((dm) => (
                                <button
                                  key={dm.id}
                                  type="button"
                                  onClick={() =>
                                    handleUpdateLine(line.key, {
                                      discountMode: dm.id,
                                      discountInput: "",
                                    })
                                  }
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${line.discountMode === dm.id
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"
                                    }`}
                                >
                                  {dm.label}
                                </button>
                              ))}
                            </div>

                            <div className="text-right font-mono text-xs">
                              {linePricing.discountAmount > 0 && (
                                <span className="text-[11px] text-slate-400 line-through mr-1.5">
                                  {formatVND(linePricing.grossLine)}
                                </span>
                              )}
                              <span className="font-extrabold text-blue-700">
                                {formatVND(linePricing.lineTotal)}
                              </span>
                            </div>
                          </div>

                          {line.discountMode !== "NONE" && (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  line.discountMode === "PERCENT"
                                    ? line.discountInput
                                    : line.discountInput
                                      ? formatNumberDots(parseNumberDots(line.discountInput))
                                      : ""
                                }
                                onChange={(e) => {
                                  if (line.discountMode === "PERCENT") {
                                    const raw = e.target.value.replace(/[^0-9.]/g, "");
                                    handleUpdateLine(line.key, { discountInput: raw });
                                  } else {
                                    const num = parseNumberDots(e.target.value);
                                    handleUpdateLine(line.key, {
                                      discountInput: num > 0 ? String(num) : "",
                                    });
                                  }
                                }}
                                placeholder={
                                  line.discountMode === "PERCENT"
                                    ? "Nhập % giảm (VD: 10)..."
                                    : line.discountMode === "AMOUNT"
                                      ? "Số tiền giảm (VNĐ)..."
                                      : "Nhập thành tiền thu sau giảm (VNĐ)..."
                                }
                                className="flex-1 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                              />
                              {linePricing.discountAmount > 0 && (
                                <span className="text-[11px] font-mono font-bold text-amber-700 shrink-0">
                                  -{formatVND(linePricing.discountAmount)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <input
                            type="text"
                            value={line.itemNote}
                            onChange={(e) =>
                              handleUpdateLine(line.key, { itemNote: e.target.value })
                            }
                            placeholder="Ghi chú đồ khách gửi (VD: Vợt Astrox 88D, căng 11kg, cước BG65...)"
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB 2 CỘT TRÁI: DANH SÁCH ĐƠN DỊCH VỤ & THEO DÕI TRẠNG THÁI */
          <div className="p-4 md:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span>Theo Dõi Trạng Thái Đơn Dịch Vụ</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <Eye className="w-3 h-3" /> Chế độ quan sát (Sales)
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Admin cập nhật tiến độ xử lý trên CMS. Khi đơn <strong>Đã xong (Chờ lấy)</strong>, Sales có thể xác nhận lấy tiền &amp; trả đồ cho khách.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchServiceOrders}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? "animate-spin" : ""}`} />
                Làm mới
              </button>
            </div>

            {/* Thẻ thống kê nhanh */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[11px] font-bold text-blue-700">Tiếp nhận / Đang làm</div>
                <div className="text-lg font-extrabold text-blue-900 mt-0.5">
                  {ordersMeta.receivedCount + ordersMeta.inProgressCount} đơn
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[11px] font-bold text-blue-700">Đã xong (Chờ lấy)</div>
                <div className="text-lg font-extrabold text-blue-900 mt-0.5">
                  {ordersMeta.readyCount} đơn
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200">
                <div className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Quá hạn hẹn trả
                </div>
                <div className="text-lg font-extrabold text-red-700 mt-0.5">
                  {ordersMeta.overdueCount} đơn
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-600">Đã trả khách</div>
                <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                  {ordersMeta.returnedCount} đơn
                </div>
              </div>
            </div>

            {/* Tìm kiếm & Lọc trạng thái */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Tìm theo SĐT, tên khách, mã đơn DV-0001, tên vợt..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "ACTIVE_ONLY", label: "Đang xử lý & Chờ lấy" },
                { id: "RECEIVED", label: "Đã tiếp nhận" },
                { id: "IN_PROGRESS", label: "Đang xử lý" },
                { id: "READY", label: "Đã xong (Chờ lấy)" },
                { id: "OVERDUE", label: `⚠️ Quá hạn (${ordersMeta.overdueCount})` },
                { id: "RETURNED", label: "Đã trả khách" },
                { id: "ALL", label: "Tất cả" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${statusFilter === tab.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Danh sách thẻ đơn dịch vụ */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {loadingOrders ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Đang tải danh sách đơn dịch vụ...
                </div>
              ) : displayedOrders.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Không có đơn dịch vụ nào khớp với bộ lọc hiện tại.
                </div>
              ) : (
                displayedOrders.map((ord) => {
                  const badge = STATUS_BADGE_MAP[ord.status] || STATUS_BADGE_MAP.RECEIVED;
                  const totalDisc =
                    (Number(ord.itemDiscountTotal) || 0) +
                    (Number(ord.billDiscountAmount) || 0);
                  const ordCardFee = Number(ord.cardFee) || 0;

                  return (
                    <div
                      key={ord._id}
                      className={`p-3.5 rounded-xl border transition ${ord.isOverdue
                        ? "border-red-300 bg-red-50/30"
                        : "border-slate-200 bg-white hover:border-blue-400"
                        }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-blue-600 text-white">
                              {ord.orderCode}
                            </span>
                            <span className="font-extrabold text-sm text-slate-900">
                              {ord.customerName}
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-600">
                              • {formatPhone(ord.customerPhone)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              Ngày gửi: <strong>{formatShortDate(ord.receivedAt)}</strong>
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 ${ord.isOverdue ? "text-red-600 font-extrabold" : ""
                                }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Hẹn trả: <strong>{formatShortDate(ord.dueAt)}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {ord.isOverdue && (
                            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-red-600 text-white flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Quá hạn hẹn trả
                            </span>
                          )}
                          <span
                            className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {/* Chi tiết dịch vụ trong đơn */}
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1">
                        {(ord.items || []).map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-2 text-xs"
                          >
                            <div className="text-slate-800">
                              <span className="font-bold">{it.serviceName}</span>{" "}
                              <span className="text-slate-500">
                                ({it.quantity} {it.unit} × {formatVND(it.unitPrice)}
                                {(Number(it.discountAmount) || 0) > 0
                                  ? ` - Giảm ${formatVND(it.discountAmount)}`
                                  : ""}
                                )
                              </span>
                              {it.itemNote && (
                                <span className="ml-1.5 text-blue-700 font-medium">
                                  — {it.itemNote}
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-bold text-slate-900 shrink-0">
                              {formatVND(it.lineTotal)}
                            </span>
                          </div>
                        ))}
                        {(totalDisc > 0 || ordCardFee > 0) && (
                          <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1 text-slate-600">
                            {totalDisc > 0 && (
                              <span className="text-amber-700 font-semibold">
                                Tổng giảm giá: -{formatVND(totalDisc)}
                              </span>
                            )}
                            {ordCardFee > 0 && (
                              <span className="text-blue-700 font-semibold">
                                Phí quẹt thẻ ({ord.cardFeePercent || 1.8}%): +
                                {formatVND(ordCardFee)}
                              </span>
                            )}
                          </div>
                        )}
                        {ord.note && (
                          <div className="text-[11px] text-slate-500 italic">
                            Ghi chú: {ord.note}
                          </div>
                        )}
                      </div>

                      {/* Tổng tiền & Trạng thái thanh toán + Nút In phiếu */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span>
                            Tổng:{" "}
                            <strong className="font-mono text-slate-900">
                              {formatVND(ord.totalAmount)}
                            </strong>
                          </span>
                          <span>
                            Đã thu:{" "}
                            <strong className="font-mono text-blue-700">
                              {formatVND(ord.paidAmount)}
                            </strong>
                          </span>
                          {ord.remainingAmount > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                              Còn thu: {formatVND(ord.remainingAmount)}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                              Đã thu đủ
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {ord.status === "READY" && ord.remainingAmount > 0 && (
                            <button
                              type="button"
                              disabled={submittingCollect}
                              onClick={() => handleOpenCollectReadyOrder(ord)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs transition"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              Xác nhận lấy tiền &amp; Trả đồ
                            </button>
                          )}
                          {ord.status === "READY" && ord.remainingAmount <= 0 && (
                            <button
                              type="button"
                              disabled={submittingCollect}
                              onClick={() => handleConfirmReturnPaidReadyOrder(ord)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs transition"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              Xác nhận trả đồ
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPrintOrder(ord)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" /> In phiếu (2 liên)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================== CỘT PHẢI (4 CỘT): BILL PHIẾU DỊCH VỤ & THANH TOÁN (ĐỒNG BỘ BÁN HÀNG) ==================== */}
      <form
        onSubmit={handleCreateServiceOrder}
        className="lg:col-span-4 bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col justify-between gap-3"
      >
        <div className="space-y-3">
          {/* Header Bill Phải */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <span className="text-xs font-extrabold uppercase tracking-wide text-slate-900">
                Bill Phiếu Dịch Vụ
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-mono font-extrabold">
              {serviceCart.length} dịch vụ
            </span>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. THÔNG TIN KHÁCH HÀNG & LỊCH HẸN */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                Khách hàng &amp; Lịch hẹn
              </span>
              {lookingUpCustomer && (
                <span className="text-[11px] text-blue-600 font-semibold">
                  Đang tra cứu SĐT...
                </span>
              )}
              {!lookingUpCustomer && isExistingCustomer && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  <UserCheck className="w-3 h-3" /> Khách quen
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                placeholder="SĐT khách hàng *"
                className="w-full h-9 px-3 text-xs sm:text-sm font-mono bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-600 rounded-lg outline-none transition"
              />
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Họ tên khách hàng *"
                className="w-full h-9 px-3 text-xs sm:text-sm bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-600 rounded-lg outline-none transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Ngày gửi *
                </label>
                <input
                  type="date"
                  required
                  value={receivedDate}
                  onChange={(e) => {
                    const nextReceived = e.target.value;
                    setReceivedDate(nextReceived);
                    if (dueDaysInput !== "" && nextReceived) {
                      const n = Number(dueDaysInput);
                      if (Number.isFinite(n) && n >= 0) {
                        setDueDate(addDaysToDateStr(nextReceived, n));
                      }
                    } else if (dueDate && nextReceived) {
                      setDueDaysInput(diffDaysStr(nextReceived, dueDate));
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-blue-700 uppercase mb-0.5">
                  Ngày hẹn trả *
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => {
                    const nextDue = e.target.value;
                    setDueDate(nextDue);
                    setDueDaysInput(
                      nextDue ? diffDaysStr(receivedDate || getTodayStr(), nextDue) : ""
                    );
                  }}
                  className={`w-full px-2.5 py-1.5 text-xs font-bold rounded-lg outline-none border focus:border-blue-600 focus:ring-1 focus:ring-blue-500 ${
                    dueDate
                      ? "text-blue-900 bg-blue-50/40 border-blue-500"
                      : "text-slate-700 bg-amber-50/40 border-amber-400"
                  }`}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                <span className="text-[10px] font-bold text-slate-600">Số ngày:</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={dueDaysInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setDueDaysInput(raw);
                    if (raw === "") {
                      setDueDate("");
                      return;
                    }
                    const days = Math.min(365, Math.max(0, Number(raw) || 0));
                    setDueDate(addDaysToDateStr(receivedDate || getTodayStr(), days));
                  }}
                  placeholder="0"
                  className="w-11 text-center font-mono text-xs font-extrabold text-blue-700 bg-white border border-slate-300 rounded px-1 py-0.5 focus:border-blue-600 outline-none"
                />
                <span className="text-[10px] text-slate-500 font-semibold">ngày</span>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {[
                  { label: "Hôm nay", days: 0 },
                  { label: "Mai", days: 1 },
                  { label: "+2 ngày", days: 2 },
                  { label: "+3 ngày", days: 3 },
                  { label: "+7 ngày", days: 7 },
                ].map((preset) => {
                  const target = addDaysToDateStr(
                    receivedDate || getTodayStr(),
                    preset.days
                  );
                  const active = dueDate === target;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setDueDate(target);
                        setDueDaysInput(String(preset.days));
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-400"
                        }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. TỔNG TIỀN, GIẢM GIÁ & KHÁCH CẦN TRẢ */}
          <div className="pt-2.5 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-700">
              <span>Tổng tiền dịch vụ ({serviceCart.length} dòng)</span>
              <span className="font-mono font-bold text-slate-900">
                {formatVND(rawSubtotal)}
              </span>
            </div>

            {itemDiscountTotal > 0 && (
              <div className="flex items-center justify-between text-amber-700">
                <span>Giảm giá từng dòng</span>
                <span className="font-mono font-bold">-{formatVND(itemDiscountTotal)}</span>
              </div>
            )}

            {/* Giảm giá tổng phiếu */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-slate-600 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                  Giảm tổng phiếu
                </span>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[10px] font-bold">
                  {(
                    [
                      { id: "NONE", label: "0" },
                      { id: "PERCENT", label: "%" },
                      { id: "AMOUNT", label: "VND" },
                      { id: "PRICE", label: "Giá chốt" },
                    ] as const
                  ).map((bm) => (
                    <button
                      key={bm.id}
                      type="button"
                      onClick={() => {
                        setBillDiscountMode(bm.id);
                        setBillDiscountInput("");
                      }}
                      className={`px-2 py-0.5 rounded-md transition ${billDiscountMode === bm.id
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-blue-700"
                        }`}
                    >
                      {bm.label}
                    </button>
                  ))}
                </div>
              </div>

              {billDiscountMode !== "NONE" && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      billDiscountMode === "PERCENT"
                        ? billDiscountInput
                        : billDiscountInput
                          ? formatNumberDots(parseNumberDots(billDiscountInput))
                          : ""
                    }
                    onChange={(e) => {
                      if (billDiscountMode === "PERCENT") {
                        setBillDiscountInput(e.target.value.replace(/[^0-9.]/g, ""));
                      } else {
                        const num = parseNumberDots(e.target.value);
                        setBillDiscountInput(num > 0 ? String(num) : "");
                      }
                    }}
                    placeholder={
                      billDiscountMode === "PERCENT"
                        ? "Nhập % giảm (VD: 10)..."
                        : billDiscountMode === "AMOUNT"
                          ? "Số tiền giảm thêm..."
                          : "Tổng tiền chốt sau giảm..."
                    }
                    className="flex-1 px-2.5 py-1 text-xs font-mono font-bold bg-amber-50/40 border border-amber-300 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                  {billDiscountAmount > 0 && (
                    <span className="font-mono font-bold text-amber-700 shrink-0">
                      -{formatVND(billDiscountAmount)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {cardFee > 0 && (
              <div className="flex items-center justify-between text-slate-700">
                <span>
                  Phí quẹt thẻ ({cardFeePercent === 4 ? "4%" : "1.8%"})
                </span>
                <span className="font-mono font-bold">+{formatVND(cardFee)}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="font-extrabold text-slate-900 text-sm">Khách cần trả</span>
              <span className="font-mono font-extrabold text-lg sm:text-xl text-blue-600">
                {formatVND(totalAmount)}
              </span>
            </div>
          </div>

          {/* 3. THỜI ĐIỂM & HÌNH THỨC THANH TOÁN */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "LATER", label: "Trả khi nhận" },
                { id: "FULL", label: "Trả đủ ngay" },
                { id: "DEPOSIT", label: "Đặt cọc" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaymentTiming(opt.id as PaymentTimingMode)}
                  className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold border transition text-center ${paymentTiming === opt.id
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-400"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {paymentTiming === "DEPOSIT" && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Số tiền khách đặt cọc trước (VNĐ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(depositAmount)}
                  onChange={(e) =>
                    setDepositAmount(
                      Math.min(totalAmount, parseNumberDots(e.target.value))
                    )
                  }
                  className="w-full px-3 py-1.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "CASH", label: "Tiền mặt", icon: Banknote },
                { id: "BANKING", label: "Chuyển khoản", icon: Landmark },
                { id: "CARD", label: "Quẹt thẻ", icon: CreditCard },
              ].map((pm) => {
                const Icon = pm.icon;
                const active = paymentMethod === pm.id;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() =>
                      handleSelectPaymentMethod(pm.id as ServicePaymentMethod)
                    }
                    className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 transition ${active
                      ? "bg-blue-600 text-white border-blue-600 font-extrabold"
                      : "bg-white text-slate-700 border-slate-200 hover:border-blue-400"
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{pm.label}</span>
                  </button>
                );
              })}
            </div>

            {paymentMethod === "CARD" && (
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                <div className="text-[11px] font-bold text-amber-900">
                  Phí quẹt thẻ (trên {formatVND(afterBillDiscount)}):
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer text-[11px] font-semibold transition ${cardFeePercent === 4
                      ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                      : "bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                      }`}
                  >
                    <input
                      type="radio"
                      name="servicePosCardFeeType"
                      checked={cardFeePercent === 4}
                      onChange={() => setCardFeePercent(4)}
                      className="accent-amber-600"
                    />
                    <span>Nước ngoài 4%</span>
                  </label>
                  <label
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer text-[11px] font-semibold transition ${cardFeePercent !== 4
                      ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                      : "bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                      }`}
                  >
                    <input
                      type="radio"
                      name="servicePosCardFeeType"
                      checked={cardFeePercent !== 4}
                      onChange={() => setCardFeePercent(1.8)}
                      className="accent-amber-600"
                    />
                    <span>Khách Việt 1.8%</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-600">
                Thu ngay:{" "}
                <strong className="font-mono text-blue-700">
                  {formatVND(computedPaidAmount)}
                </strong>
              </span>
              <span className="text-slate-600">
                Còn thu:{" "}
                <strong className="font-mono text-rose-600">
                  {formatVND(computedRemainingAmount)}
                </strong>
              </span>
            </div>

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú chung của phiếu dịch vụ..."
              className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-lg outline-none transition"
            />
          </div>
        </div>

        {/* Nút CTA lớn đáy Bill phải (Đồng bộ nút THANH TOÁN ở Bán hàng) */}
        <button
          type="submit"
          disabled={submitting || serviceCart.length === 0}
          className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold text-base tracking-wide uppercase flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
        >
          <Wrench className="w-4 h-4" />
          <span>{submitting ? "Đang tạo phiếu..." : "Tạo Phiếu Dịch Vụ"}</span>
        </button>
      </form>

      {/* MODAL XÁC NHẬN LẤY TIỀN & TRẢ ĐỒ KHI ĐƠN ĐÃ LÀM XONG (READY) */}
      {collectModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                Xác Nhận Lấy Tiền &amp; Trả Đồ ({collectModalOrder.orderCode})
              </h3>
              <button
                type="button"
                onClick={() => setCollectModalOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCollectAndReturn} className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>
                  Khách hàng: <strong>{collectModalOrder.customerName}</strong> (
                  {formatPhone(collectModalOrder.customerPhone)})
                </div>
                <div>
                  Tổng tiền:{" "}
                  <strong className="font-mono">
                    {formatVND(collectModalOrder.totalAmount)}
                  </strong>{" "}
                  • Đã thu:{" "}
                  <strong className="font-mono text-blue-700">
                    {formatVND(collectModalOrder.paidAmount)}
                  </strong>
                </div>
                <div className="text-sm font-extrabold text-rose-600 pt-1">
                  Còn phải thu: {formatVND(collectModalOrder.remainingAmount)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số tiền thu khi khách nhận đồ (VNĐ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(collectAmountInput)}
                  onChange={(e) =>
                    setCollectAmountInput(
                      Math.min(
                        collectModalOrder.remainingAmount,
                        parseNumberDots(e.target.value)
                      )
                    )
                  }
                  className="w-full px-3 py-2 text-sm font-mono font-extrabold bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phương thức thanh toán
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "CASH", label: "Tiền mặt" },
                    { id: "BANKING", label: "Chuyển khoản" },
                    { id: "CARD", label: "Quẹt thẻ" },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setCollectMethod(pm.id as ServicePaymentMethod)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border ${collectMethod === pm.id
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-300"
                        }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {collectMethod === "CARD" && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
                  <div className="text-[11px] font-bold text-amber-900">
                    Phí quẹt thẻ (tính trên {formatVND(collectAmountInput)}):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${collectCardFeePercent === 4
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                        }`}
                    >
                      <input
                        type="radio"
                        name="posReadyCollectCardFeeType"
                        checked={collectCardFeePercent === 4}
                        onChange={() => setCollectCardFeePercent(4)}
                        className="accent-amber-600"
                      />
                      <span>
                        Khách nước ngoài 4% (+
                        {formatVND(Math.round(collectAmountInput * 0.04))})
                      </span>
                    </label>
                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${collectCardFeePercent !== 4
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                        }`}
                    >
                      <input
                        type="radio"
                        name="posReadyCollectCardFeeType"
                        checked={collectCardFeePercent !== 4}
                        onChange={() => setCollectCardFeePercent(1.8)}
                        className="accent-amber-600"
                      />
                      <span>
                        Khách Việt 1.8% (+
                        {formatVND(Math.round(collectAmountInput * 0.018))})
                      </span>
                    </label>
                  </div>
                  <div className="flex justify-between text-amber-800 pt-0.5">
                    <span>
                      Phí thẻ (+{collectCardFeePercent}%): +
                      {formatVND(
                        Math.round((collectAmountInput * collectCardFeePercent) / 100)
                      )}
                    </span>
                    <strong className="font-mono">
                      Tổng quẹt:{" "}
                      {formatVND(
                        collectAmountInput +
                        Math.round((collectAmountInput * collectCardFeePercent) / 100)
                      )}
                    </strong>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú thu tiền
                </label>
                <input
                  type="text"
                  value={collectNote}
                  onChange={(e) => setCollectNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectModalOrder(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={submittingCollect}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold"
                >
                  {submittingCollect ? "Đang xử lý..." : "Xác nhận Thu tiền & Trả đồ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IN HÓA ĐƠN / PHIẾU DỊCH VỤ (2 BẢN: KHÁCH HÀNG & SHOP — KHỔ K80) */}
      {printOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            {/* Thanh công cụ Modal */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-blue-600 text-white">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm">
                  Xem trước Hóa Đơn Dịch Vụ (2 bản: Khách &amp; Shop) — {printOrder.orderCode}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-700/80 border border-white/20 text-xs font-semibold text-white">
                  Khổ K80 (80mm)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePrintServiceReceipt("SPLIT_2_BILLS")}
                  title="Tách thành 2 lệnh in riêng biệt để máy in K80 tự động cắt rời Liên 1 và Liên 2"
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  In 2 Bill (Tự cắt rời)
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintServiceReceipt("COPY_1")}
                  title="Chỉ in Liên 1 (Bản giao khách)"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  In Liên 1 (Khách)
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintServiceReceipt("COPY_2")}
                  title="Chỉ in Liên 2 (Bản lưu shop)"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  In Liên 2 (Shop)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOrder(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Vùng hiển thị 2 bản hóa đơn dịch vụ */}
            <div className="p-6 bg-slate-100 max-h-[80vh] overflow-y-auto flex justify-center">
              <div
                ref={servicePrintRef}
                id="service-receipt-print-area"
                className="w-full max-w-[330px] space-y-6"
              >
                {(
                  [
                    {
                      copyIndex: 1,
                      copyBadge: "LIÊN 1: BẢN GIAO KHÁCH",
                      copySub: "Khách hàng giữ phiếu này để đối chiếu khi nhận đồ",
                      isShopCopy: false,
                    },
                    {
                      copyIndex: 2,
                      copyBadge: "LIÊN 2: BẢN LƯU SHOP",
                      copySub: "Cửa hàng giữ / kẹp cùng đồ khách gửi",
                      isShopCopy: true,
                    },
                  ] as const
                ).map((copy, cIdx) => {
                  const statusInfo =
                    STATUS_BADGE_MAP[printOrder.status] || STATUS_BADGE_MAP.RECEIVED;
                  const pmLabel =
                    printOrder.paymentMethod === "BANKING"
                      ? "Chuyển khoản"
                      : printOrder.paymentMethod === "CARD"
                        ? "Quẹt thẻ (Card)"
                        : "Tiền mặt";
                  return (
                    <React.Fragment key={copy.copyIndex}>
                      {cIdx > 0 && (
                        <div className="no-print-cut-line flex items-center gap-2 py-1 text-[11px] font-mono font-bold text-slate-400 select-none">
                          <div className="flex-1 border-t-2 border-dashed border-slate-300" />
                          <span>✂ CẮT TẠI ĐÂY (TỰ ĐỘNG TÁCH 2 BẢN KHI IN)</span>
                          <div className="flex-1 border-t-2 border-dashed border-slate-300" />
                        </div>
                      )}

                      <div className="service-bill-copy bg-white text-black border border-slate-300 shadow-sm p-3.5 text-[12px]">
                        {/* Header 11Sport giống mẫu Hóa Đơn Bán Hàng */}
                        <div className="text-center border-b-2 border-black pb-2.5 mb-2.5">
                          <div className="flex justify-center mb-1.5">
                            <img
                              src="/logo-11sport.svg"
                              alt="11Sport Logo"
                              className="h-10 w-auto object-contain"
                            />
                          </div>
                          <p className="text-[11px] font-semibold text-black leading-snug">
                            Địa chỉ: 24 Tố Hữu, P.Hòa Cường, TP. Đà Nẵng
                          </p>
                          <p className="text-[11px] font-bold text-black mt-0.5">
                            Hotline: 076.576.3456
                          </p>
                          <h2 className="font-black uppercase mt-2 tracking-wide text-sm">
                            HÓA ĐƠN / PHIẾU DỊCH VỤ
                          </h2>
                          <div className="mt-1 inline-block px-2.5 py-0.5 border border-black rounded font-extrabold text-[11px] uppercase tracking-wider">
                            {copy.copyBadge}
                          </div>
                          <p className="text-[10px] italic text-black/80 mt-0.5">
                            ({copy.copySub})
                          </p>
                        </div>

                        {/* Thông tin chung & Khách hàng */}
                        <div className="space-y-1 text-xs border-b border-dashed border-black pb-2.5 mb-2.5">
                          <div className="flex justify-between">
                            <span className="font-semibold">Mã phiếu:</span>
                            <span className="font-mono font-black text-sm">
                              {printOrder.orderCode}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold">Ngày lập:</span>
                            <span className="font-mono">
                              {formatDateTime(
                                printOrder.createdAt || printOrder.receivedAt
                              )}
                            </span>
                          </div>
                          {printOrder.createdByName && (
                            <div className="flex justify-between">
                              <span className="font-semibold">Nhân viên nhận:</span>
                              <span className="font-bold">{printOrder.createdByName}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="font-semibold">Khách hàng:</span>
                            <span className="font-black uppercase">
                              {printOrder.customerName}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold">Số ĐT:</span>
                            <span className="font-mono font-bold">
                              {formatPhone(printOrder.customerPhone)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold">Ngày gửi đồ:</span>
                            <span className="font-mono font-bold">
                              {formatShortDate(printOrder.receivedAt)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold">Ngày hẹn trả:</span>
                            <span className="font-mono font-black underline">
                              {formatShortDate(printOrder.dueAt)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold">Trạng thái:</span>
                            <span className="font-bold">{statusInfo.label}</span>
                          </div>
                        </div>

                        {/* Bảng danh sách dịch vụ */}
                        <table className="w-full text-xs border-collapse mb-3">
                          <thead>
                            <tr className="border-b-2 border-black text-left">
                              <th className="py-1 font-bold">Dịch vụ</th>
                              <th className="py-1 font-bold text-center w-9">SL</th>
                              <th className="py-1 font-bold text-right">Đ.Giá</th>
                              <th className="py-1 font-bold text-right">T.Tiền</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-dashed divide-slate-300">
                            {(printOrder.items || []).map((it, idx) => (
                              <tr key={idx} className="align-top">
                                <td className="py-1.5 pr-1">
                                  <div className="font-bold text-black">
                                    {idx + 1}. {it.serviceName}
                                  </div>
                                  {(Number(it.discountAmount) || 0) > 0 && (
                                    <div className="text-[10px] font-semibold text-black mt-0.5">
                                      • Giảm giá dòng: -{formatNumberDots(it.discountAmount)}
                                    </div>
                                  )}
                                  {it.itemNote && (
                                    <div className="text-[11px] font-semibold text-black mt-0.5">
                                      • Ghi chú: {it.itemNote}
                                    </div>
                                  )}
                                </td>
                                <td className="py-1.5 text-center font-mono font-bold">
                                  {it.quantity}
                                </td>
                                <td className="py-1.5 text-right font-mono">
                                  {formatNumberDots(it.unitPrice)}
                                </td>
                                <td className="py-1.5 text-right font-mono font-bold">
                                  {formatNumberDots(it.lineTotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Tổng kết thanh toán */}
                        <div className="border-t-2 border-black pt-2 space-y-1 text-xs">
                          {((Number(printOrder.itemDiscountTotal) || 0) > 0 ||
                            (Number(printOrder.billDiscountAmount) || 0) > 0 ||
                            (Number(printOrder.cardFee) || 0) > 0) && (
                              <>
                                <div className="flex justify-between">
                                  <span>Tạm tính:</span>
                                  <span className="font-mono">
                                    {formatVND(
                                      printOrder.rawSubtotal ??
                                      printOrder.subtotal ??
                                      printOrder.totalAmount
                                    )}
                                  </span>
                                </div>
                                {(Number(printOrder.itemDiscountTotal) || 0) +
                                  (Number(printOrder.billDiscountAmount) || 0) >
                                  0 && (
                                    <div className="flex justify-between">
                                      <span>Giảm giá:</span>
                                      <span className="font-mono font-semibold">
                                        -
                                        {formatVND(
                                          (Number(printOrder.itemDiscountTotal) || 0) +
                                          (Number(printOrder.billDiscountAmount) || 0)
                                        )}
                                      </span>
                                    </div>
                                  )}
                                {(Number(printOrder.cardFee) || 0) > 0 && (
                                  <div className="flex justify-between">
                                    <span>
                                      Phí quẹt thẻ ({printOrder.cardFeePercent || 1.8}%):
                                    </span>
                                    <span className="font-mono font-semibold">
                                      +{formatVND(printOrder.cardFee)}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          <div className="flex justify-between font-bold">
                            <span>Tổng tiền dịch vụ:</span>
                            <span className="font-mono text-sm font-black">
                              {formatVND(printOrder.totalAmount)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Đã thanh toán ({pmLabel}):</span>
                            <span className="font-mono font-bold">
                              {formatVND(printOrder.paidAmount)}
                            </span>
                          </div>
                          <div className="flex justify-between font-black text-sm pt-1 border-t border-dashed border-black">
                            <span>CÒN PHẢI THU KHI NHẬN:</span>
                            <span className="font-mono">
                              {formatVND(printOrder.remainingAmount)}
                            </span>
                          </div>
                        </div>

                        {printOrder.note && (
                          <div className="mt-2.5 pt-2 border-t border-dashed border-slate-400 text-[11px]">
                            <span className="font-bold">Ghi chú phiếu: </span>
                            <span>{printOrder.note}</span>
                          </div>
                        )}

                        {/* Chân chữ ký / đối chiếu tùy theo bản Khách hay bản Shop */}
                        {copy.isShopCopy ? (
                          <div className="mt-3 pt-2 border-t border-dashed border-black text-[11px] space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-center font-bold">
                              <div>
                                <div>KHÁCH HÀNG KÝ GỬI</div>
                                <div className="h-10" />
                                <div className="font-normal text-[10px]">
                                  (Ký &amp; ghi rõ họ tên)
                                </div>
                              </div>
                              <div>
                                <div>NHÂN VIÊN TIẾP NHẬN</div>
                                <div className="h-10" />
                                <div className="font-normal text-[10px]">
                                  {printOrder.createdByName || "(Ký xác nhận)"}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 pt-2 border-t border-dashed border-slate-400 text-center text-[11px] space-y-0.5">
                            <p className="font-bold">
                              Quý khách vui lòng mang theo phiếu này khi đến nhận đồ.
                            </p>
                            <p className="font-bold text-black">
                              Cảm ơn Quý khách đã tin tưởng 11Sport!
                            </p>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
