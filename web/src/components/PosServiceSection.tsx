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
    label: "Đã nhận đồ",
    cls: "bg-sky-50 text-sky-700 border-sky-200",
  },
  IN_PROGRESS: {
    label: "Đang xử lý",
    cls: "bg-amber-50 text-amber-800 border-amber-300",
  },
  READY: {
    label: "Đã xong (Chờ lấy)",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-300",
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

function addDaysStr(days: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  const [dueDate, setDueDate] = useState<string>(addDaysStr(1));
  const [billDiscountMode, setBillDiscountMode] = useState<ServiceDiscountMode>("NONE");
  const [billDiscountInput, setBillDiscountInput] = useState<string>("");
  const [paymentTiming, setPaymentTiming] = useState<PaymentTimingMode>("LATER");
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<ServicePaymentMethod>("CASH");
  const [cardFeePercent, setCardFeePercent] = useState<number>(1.8);
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

  // Modal in phiếu dịch vụ (In 2 bản: Bản giao khách + Bản lưu shop, giống form hóa đơn bán hàng)
  const [printOrder, setPrintOrder] = useState<ServiceOrder | null>(null);
  const [printPaperSize, setPrintPaperSize] = useState<"K80" | "A4">("K80");
  const servicePrintRef = useRef<HTMLDivElement>(null);

  const handlePrintServiceReceipt = () => {
    if (!servicePrintRef.current || !printOrder) return;
    const printContents = servicePrintRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=900,height=800");
    if (!printWindow) {
      window.print();
      return;
    }

    const isK80 = printPaperSize === "K80";
    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <title>Hóa đơn dịch vụ ${printOrder.orderCode} (2 bản)</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page {
              size: ${isK80 ? "80mm auto" : "A4 portrait"};
              margin: ${isK80 ? "3mm" : "12mm"};
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
            .print-wrapper {
              width: ${isK80 ? "74mm" : "100%"};
              max-width: ${isK80 ? "74mm" : "190mm"};
              margin: 0 auto;
            }
            .service-bill-copy + .service-bill-copy {
              page-break-before: always;
              break-before: page;
              margin-top: 0 !important;
            }
            @media print {
              .no-print-cut-line {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${printContents}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
                window.close();
              }, 350);
            };
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
      setDueDate(addDaysStr(1));
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
      {/* CỘT TRÁI: FORM TẠO ĐƠN DỊCH VỤ (NHẬN ĐỒ KHÁCH GỬI) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Nhận Đồ & Tạo Phiếu Dịch Vụ
                </h2>
                <p className="text-xs text-slate-500">
                  Chọn dịch vụ, điền thông tin khách, ngày gửi, ngày hẹn trả & giá
                </p>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. CHỌN LOẠI DỊCH VỤ */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {serviceTypes.map((st) => (
                  <button
                    key={st._id}
                    type="button"
                    onClick={() => handleAddServiceType(st)}
                    className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition flex flex-col justify-between group bg-slate-50/60"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 line-clamp-1">
                        {st.name}
                      </div>
                      {st.description && (
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {st.description}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-200/70 flex items-center justify-between">
                      <span className="font-mono text-xs font-extrabold text-indigo-700">
                        {formatVND(st.defaultPrice)}/{st.unit || "Cây"}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-indigo-600">
                        <Plus className="w-3.5 h-3.5" /> Thêm
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleCreateServiceOrder} className="mt-4 space-y-4">
            {/* 2. DANH SÁCH DỊCH VỤ ĐÃ CHỌN & SỬA GIÁ */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-700 mb-2">
                2. Chi tiết dịch vụ & Giá thực tế ({serviceCart.length})
              </label>

              {serviceCart.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
                  Chưa chọn dịch vụ nào. Hãy bấm vào Loại dịch vụ ở mục 1 phía trên.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {serviceCart.map((line, idx) => {
                    const linePricing = computeServiceLinePricing(line);
                    return (
                      <div
                        key={line.key}
                        className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-2"
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
                              className="w-full px-2.5 py-1.5 text-sm font-mono font-extrabold text-indigo-800 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
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

                        {/* GIẢM GIÁ DÒNG DỊCH VỤ (GIỐNG BÁN HÀNG POS) */}
                        <div className="pt-1 border-t border-indigo-100 space-y-1.5">
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
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                    line.discountMode === dm.id
                                      ? "bg-amber-600 text-white border-amber-600"
                                      : "bg-white text-slate-600 border-slate-300 hover:border-amber-400"
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
                              <span className="font-extrabold text-indigo-900">
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
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. THÔNG TIN KHÁCH HÀNG */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                  3. Thông tin Khách hàng & Lịch hẹn
                </span>
                {lookingUpCustomer && (
                  <span className="text-[11px] text-indigo-600 font-semibold">
                    Đang tra cứu SĐT...
                  </span>
                )}
                {!lookingUpCustomer && isExistingCustomer && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <UserCheck className="w-3.5 h-3.5" /> Khách quen
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số điện thoại KH <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                    placeholder="0909 123 456"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên khách hàng <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nhập họ tên khách..."
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* NGÀY GỬI & NGÀY HẸN TRẢ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày gửi đồ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày hẹn trả <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold text-indigo-900 bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Nút chọn nhanh ngày hẹn trả */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500">
                  Hẹn nhanh:
                </span>
                {[
                  { label: "Hôm nay", days: 0 },
                  { label: "Ngày mai", days: 1 },
                  { label: "+2 ngày", days: 2 },
                  { label: "+3 ngày", days: 3 },
                  { label: "+7 ngày", days: 7 },
                ].map((preset) => {
                  const target = addDaysStr(preset.days);
                  const active = dueDate === target;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDueDate(target)}
                      className={`px-2 py-1 rounded text-[11px] font-bold border transition ${
                        active
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. GIẢM GIÁ, PHÍ QUẸT THẺ & HÌNH THỨC THU TIỀN (GIỐNG BÁN HÀNG) */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                  4. Giảm giá, Phí thẻ & Thanh toán
                </span>
                <span className="font-mono text-base font-extrabold text-indigo-700">
                  Tổng: {formatVND(totalAmount)}
                </span>
              </div>

              {/* Giảm giá tổng hóa đơn dịch vụ */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    Giảm giá tổng phiếu:
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      [
                        { id: "NONE", label: "Không giảm" },
                        { id: "PERCENT", label: "Giảm %" },
                        { id: "AMOUNT", label: "Giảm tiền" },
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
                        className={`px-2 py-1 rounded text-[11px] font-bold border transition ${
                          billDiscountMode === bm.id
                            ? "bg-amber-600 text-white border-amber-600"
                            : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
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
                          setBillDiscountInput(
                            e.target.value.replace(/[^0-9.]/g, "")
                          );
                        } else {
                          const num = parseNumberDots(e.target.value);
                          setBillDiscountInput(num > 0 ? String(num) : "");
                        }
                      }}
                      placeholder={
                        billDiscountMode === "PERCENT"
                          ? "Nhập % giảm tổng phiếu (VD: 10)..."
                          : billDiscountMode === "AMOUNT"
                            ? "Nhập số tiền giảm thêm (VNĐ)..."
                            : "Nhập tổng tiền chốt sau giảm (VNĐ)..."
                      }
                      className="flex-1 px-2.5 py-1.5 text-xs font-mono font-bold bg-amber-50/40 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    {billDiscountAmount > 0 && (
                      <span className="text-xs font-mono font-bold text-amber-700 shrink-0">
                        -{formatVND(billDiscountAmount)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 3 TÙY CHỌN THỜI ĐIỂM THANH TOÁN: TRẢ LÚC NHẬN HÀNG / TRẢ LÚC GỬI HÀNG / ĐẶT CỌC */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "LATER", label: "Trả lúc nhận đồ (0đ)" },
                  { id: "FULL", label: "Trả lúc gửi đồ (Thu đủ)" },
                  { id: "DEPOSIT", label: "Khách đặt cọc" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentTiming(opt.id as PaymentTimingMode)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold border transition text-center ${
                      paymentTiming === opt.id
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {paymentTiming === "DEPOSIT" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
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
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phương thức thanh toán{" "}
                  {paymentTiming === "LATER" && "(Dự kiến / Tính phí thẻ)"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "CASH", label: "Tiền mặt", icon: Banknote },
                    { id: "BANKING", label: "Chuyển khoản", icon: Landmark },
                    { id: "CARD", label: "Quẹt thẻ", icon: CreditCard },
                  ].map((pm) => {
                    const Icon = pm.icon;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() =>
                          handleSelectPaymentMethod(pm.id as ServicePaymentMethod)
                        }
                        className={`py-2 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 ${
                          paymentMethod === pm.id
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-slate-700 border-slate-300"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {pm.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PHÍ QUẸT THẺ (GIỐNG BÁN HÀNG POS: KHÁCH NƯỚC NGOÀI 4% / KHÁCH VIỆT 1.8%) */}
              {paymentMethod === "CARD" && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                  <div className="text-[11px] font-bold text-amber-900">
                    Phí quẹt thẻ (tính trên {formatVND(afterBillDiscount)} sau giảm giá):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${
                        cardFeePercent === 4
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
                      <span>
                        Khách nước ngoài 4% (+
                        {formatVND(Math.round(afterBillDiscount * 0.04))})
                      </span>
                    </label>
                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${
                        cardFeePercent !== 4
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
                      <span>
                        Khách Việt 1.8% (+
                        {formatVND(Math.round(afterBillDiscount * 0.018))})
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Tóm tắt chi tiết các mục tiền */}
              {(itemDiscountTotal > 0 || billDiscountAmount > 0 || cardFee > 0) && (
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Tổng tiền dịch vụ gốc:</span>
                    <span className="font-mono">{formatVND(rawSubtotal)}</span>
                  </div>
                  {itemDiscountTotal > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Giảm giá từng dòng:</span>
                      <span className="font-mono">-{formatVND(itemDiscountTotal)}</span>
                    </div>
                  )}
                  {billDiscountAmount > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>
                        Giảm giá tổng phiếu
                        {billDiscountType === "PERCENT"
                          ? ` (${billDiscountValue}%)`
                          : ""}
                        :
                      </span>
                      <span className="font-mono">-{formatVND(billDiscountAmount)}</span>
                    </div>
                  )}
                  {cardFee > 0 && (
                    <div className="flex justify-between text-indigo-700">
                      <span>
                        Phí quẹt thẻ (
                        {cardFeePercent === 4
                          ? "Khách nước ngoài 4%"
                          : "Khách Việt 1.8%"}
                        ):
                      </span>
                      <span className="font-mono">+{formatVND(cardFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-slate-900 pt-1 border-t border-slate-100">
                    <span>Tổng thanh toán:</span>
                    <span className="font-mono text-indigo-700">
                      {formatVND(totalAmount)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                <span className="text-slate-600">
                  Thu ngay:{" "}
                  <strong className="font-mono text-emerald-700">
                    {formatVND(computedPaidAmount)}
                  </strong>
                </span>
                <span className="text-slate-600">
                  Còn phải thu khi trả đồ:{" "}
                  <strong className="font-mono text-rose-600">
                    {formatVND(computedRemainingAmount)}
                  </strong>
                </span>
              </div>

              <div>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú chung của phiếu dịch vụ (tùy chọn)..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || serviceCart.length === 0}
              className="w-full py-3 px-4 rounded-xl font-extrabold text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm transition flex items-center justify-center gap-2"
            >
              <Wrench className="w-4 h-4" />
              {submitting ? "Đang tạo phiếu dịch vụ..." : "Tạo Phiếu Dịch Vụ"}
            </button>
          </form>
        </div>
      </div>

      {/* CỘT PHẢI: DANH SÁCH ĐƠN DỊCH VỤ (SALES TIẾP NHẬN & QUAN SÁT TRẠNG THÁI) */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>Theo Dõi Trạng Thái Đơn Dịch Vụ</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Eye className="w-3 h-3" /> Chế độ quan sát (Sales)
                </span>
              </h2>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
              <div className="text-[11px] font-bold text-sky-700">Đã nhận / Đang làm</div>
              <div className="text-lg font-extrabold text-sky-900 mt-0.5">
                {ordersMeta.receivedCount + ordersMeta.inProgressCount} đơn
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-[11px] font-bold text-emerald-700">Đã xong (Chờ lấy)</div>
              <div className="text-lg font-extrabold text-emerald-900 mt-0.5">
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
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Tìm theo SĐT, tên khách, mã đơn DV-0001, tên vợt..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[
              { id: "ACTIVE_ONLY", label: "Đang xử lý & Chờ lấy" },
              { id: "RECEIVED", label: "Đã nhận đồ" },
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
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                  statusFilter === tab.id
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Danh sách thẻ đơn dịch vụ */}
          <div className="mt-4 space-y-3 max-h-[680px] overflow-y-auto pr-1">
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
                    className={`p-3.5 rounded-xl border transition ${
                      ord.isOverdue
                        ? "border-red-300 bg-red-50/30"
                        : "border-slate-200 bg-white hover:border-indigo-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-indigo-100 text-indigo-900">
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
                            className={`inline-flex items-center gap-1 ${
                              ord.isOverdue ? "text-red-600 font-extrabold" : ""
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
                              <span className="ml-1.5 text-indigo-700 font-medium">
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
                            <span className="text-indigo-700 font-semibold">
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
                          <strong className="font-mono text-emerald-700">
                            {formatVND(ord.paidAmount)}
                          </strong>
                        </span>
                        {ord.remainingAmount > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                            Còn thu: {formatVND(ord.remainingAmount)}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
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
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs transition"
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
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs transition"
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
      </div>

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
                  <strong className="font-mono text-emerald-700">
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
                      className={`py-2 px-2 rounded-lg text-xs font-bold border ${
                        collectMethod === pm.id
                          ? "bg-emerald-600 text-white border-emerald-600"
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
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${
                        collectCardFeePercent === 4
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
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${
                        collectCardFeePercent !== 4
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
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                >
                  {submittingCollect ? "Đang xử lý..." : "Xác nhận Thu tiền & Trả đồ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IN HÓA ĐƠN / PHIẾU DỊCH VỤ (2 BẢN: KHÁCH HÀNG & SHOP — CHUẨN FORM HÓA ĐƠN K80/A4) */}
      {printOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            {/* Thanh công cụ Modal */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm">
                  Xem trước Hóa Đơn Dịch Vụ (2 bản: Khách &amp; Shop) — {printOrder.orderCode}
                </span>
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPrintPaperSize("K80")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      printPaperSize === "K80"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Khổ K80 (80mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintPaperSize("A4")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      printPaperSize === "A4"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Khổ A4
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintServiceReceipt}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
                >
                  <Printer className="w-4 h-4" />
                  In Hóa Đơn Dịch Vụ (2 Bản)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOrder(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
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
                className={`w-full ${
                  printPaperSize === "K80" ? "max-w-[330px]" : "max-w-[680px]"
                } space-y-6`}
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
                  const isK80 = printPaperSize === "K80";
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

                      <div
                        className={`service-bill-copy bg-white text-black border border-slate-300 shadow-sm ${
                          isK80 ? "p-3.5 text-[12px]" : "p-7 text-sm"
                        }`}
                      >
                        {/* Header 11Sport giống mẫu Hóa Đơn Bán Hàng */}
                        <div className="text-center border-b-2 border-black pb-2.5 mb-2.5">
                          <div className="flex justify-center mb-1.5">
                            <img
                              src="/logo-11sport.svg"
                              alt="11Sport Logo"
                              className={
                                isK80
                                  ? "h-10 w-auto object-contain"
                                  : "h-12 w-auto object-contain"
                              }
                            />
                          </div>
                          <p className="text-[11px] font-semibold text-black leading-snug">
                            Địa chỉ: 24 Tố Hữu, P.Hòa Cường, TP. Đà Nẵng
                          </p>
                          <p className="text-[11px] font-bold text-black mt-0.5">
                            Hotline: 076.576.3456
                          </p>
                          <h2
                            className={`font-black uppercase mt-2 tracking-wide ${
                              isK80 ? "text-sm" : "text-lg"
                            }`}
                          >
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
