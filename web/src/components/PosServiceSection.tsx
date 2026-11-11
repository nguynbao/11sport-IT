"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ServiceType,
  ServiceOrder,
  ServiceOrderStatus,
  ServicePaymentMethod,
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
  ArrowRight,
  PackageCheck,
  Play,
  X,
} from "lucide-react";

interface ServiceCartLine {
  key: string;
  serviceTypeId: string;
  serviceCode: string;
  serviceName: string;
  unit: string;
  defaultPrice: number;
  unitPrice: number;
  quantity: number;
  itemNote: string;
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
  const [paymentTiming, setPaymentTiming] = useState<PaymentTimingMode>("LATER");
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<ServicePaymentMethod>("CASH");
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

  // Modal trả đồ & thu tiền còn lại
  const [returnModalOrder, setReturnModalOrder] = useState<ServiceOrder | null>(null);
  const [collectMethod, setCollectMethod] = useState<ServicePaymentMethod>("CASH");
  const [collectAmountInput, setCollectAmountInput] = useState<number>(0);
  const [collectNote, setCollectNote] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState<string>("");

  // Modal in phiếu dịch vụ
  const [printOrder, setPrintOrder] = useState<ServiceOrder | null>(null);

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
        itemNote: "",
      },
    ]);
  };

  const handleUpdateLine = (
    key: string,
    patch: Partial<Pick<ServiceCartLine, "unitPrice" | "quantity" | "itemNote">>
  ) => {
    setServiceCart((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  const handleRemoveLine = (key: string) => {
    setServiceCart((prev) => prev.filter((l) => l.key !== key));
  };

  const totalAmount = useMemo(
    () =>
      serviceCart.reduce(
        (sum, item) => sum + Math.max(0, item.unitPrice) * Math.max(1, item.quantity),
        0
      ),
    [serviceCart]
  );

  const computedPaidAmount = useMemo(() => {
    if (paymentTiming === "FULL") return totalAmount;
    if (paymentTiming === "LATER") return 0;
    return Math.min(totalAmount, Math.max(0, depositAmount));
  }, [paymentTiming, totalAmount, depositAmount]);

  const computedRemainingAmount = Math.max(0, totalAmount - computedPaidAmount);

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
        items: serviceCart.map((l) => ({
          serviceTypeId: l.serviceTypeId,
          serviceCode: l.serviceCode,
          serviceName: l.serviceName,
          unit: l.unit,
          defaultPrice: l.defaultPrice,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          itemNote: l.itemNote.trim(),
        })),
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
      setPaymentTiming("LATER");
      setDepositAmount(0);
      setNote("");
      fetchServiceOrders();
      setPrintOrder(created);
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tạo phiếu dịch vụ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (
    order: ServiceOrder,
    nextStatus: ServiceOrderStatus
  ) => {
    // Nếu bấm "Đã trả khách" mà còn tiền chưa thu -> mở popup xác nhận thu tiền & trả đồ
    if (nextStatus === "RETURNED" && order.remainingAmount > 0) {
      setReturnModalOrder(order);
      setCollectAmountInput(order.remainingAmount);
      setCollectMethod(order.paymentMethod || "CASH");
      setCollectNote("Thu tiền khi khách nhận đồ");
      return;
    }

    setUpdatingStatusId(order._id);
    setErrorMsg("");
    try {
      await apiRequest(`/service-orders/${order._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccessMsg(
        `Đã cập nhật đơn ${order.orderCode} sang "${STATUS_BADGE_MAP[nextStatus].label}"`
      );
      fetchServiceOrders();
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi cập nhật trạng thái đơn dịch vụ");
    } finally {
      setUpdatingStatusId("");
    }
  };

  const handleConfirmReturnAndCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalOrder) return;
    setUpdatingStatusId(returnModalOrder._id);
    setErrorMsg("");
    try {
      await apiRequest(`/service-orders/${returnModalOrder._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "RETURNED",
          collectAmount: collectAmountInput,
          paymentMethod: collectMethod,
          paymentNote: collectNote.trim() || "Thu tiền khi trả đồ cho khách",
        }),
      });
      setSuccessMsg(
        `Đã trả đồ & thu ${formatVND(collectAmountInput)} cho đơn ${returnModalOrder.orderCode}!`
      );
      setReturnModalOrder(null);
      fetchServiceOrders();
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi xác nhận trả đồ");
    } finally {
      setUpdatingStatusId("");
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
                  {serviceCart.map((line, idx) => (
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
                  ))}
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

            {/* 4. THANH TOÁN */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                  4. Hình thức thu tiền
                </span>
                <span className="font-mono text-base font-extrabold text-indigo-700">
                  Tổng: {formatVND(totalAmount)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "LATER", label: "Thu lúc nhận đồ (0đ)" },
                  { id: "FULL", label: "Thu đủ ngay" },
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

              {paymentTiming !== "LATER" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phương thức thanh toán
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
                            setPaymentMethod(pm.id as ServicePaymentMethod)
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

      {/* CỘT PHẢI: DANH SÁCH ĐƠN DỊCH VỤ ĐANG XỬ LÝ / CHỜ TRẢ KHÁCH */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Danh Sách Đơn Dịch Vụ Tại Quầy
              </h2>
              <p className="text-xs text-slate-500">
                Theo dõi tiến độ làm dịch vụ, cảnh báo quá hạn hẹn trả & thu tiền khi trả đồ
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
                const isBusy = updatingStatusId === ord._id;

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
                              ({it.quantity} {it.unit} × {formatVND(it.unitPrice)})
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
                      {ord.note && (
                        <div className="text-[11px] text-slate-500 italic">
                          Ghi chú: {ord.note}
                        </div>
                      )}
                    </div>

                    {/* Tổng tiền & Trạng thái thanh toán + Nút thao tác */}
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
                        <button
                          type="button"
                          onClick={() => setPrintOrder(ord)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" /> In phiếu
                        </button>

                        {ord.status === "RECEIVED" && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleQuickStatusChange(ord, "IN_PROGRESS")
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1"
                          >
                            <Play className="w-3.5 h-3.5" /> Bắt đầu làm
                          </button>
                        )}

                        {(ord.status === "RECEIVED" ||
                          ord.status === "IN_PROGRESS") && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQuickStatusChange(ord, "READY")}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Đã xong
                          </button>
                        )}

                        {ord.status !== "RETURNED" &&
                          ord.status !== "CANCELLED" && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleQuickStatusChange(ord, "RETURNED")
                              }
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              {ord.remainingAmount > 0
                                ? "Trả đồ & Thu tiền"
                                : "Đã trả khách"}
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* MODAL TRẢ ĐỒ & THU TIỀN CÒN LẠI */}
      {returnModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                Trả Đồ & Thu Tiền Dịch Vụ ({returnModalOrder.orderCode})
              </h3>
              <button
                type="button"
                onClick={() => setReturnModalOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReturnAndCollect} className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>
                  Khách hàng: <strong>{returnModalOrder.customerName}</strong> (
                  {formatPhone(returnModalOrder.customerPhone)})
                </div>
                <div>
                  Tổng tiền dịch vụ:{" "}
                  <strong className="font-mono">
                    {formatVND(returnModalOrder.totalAmount)}
                  </strong>{" "}
                  • Đã thu:{" "}
                  <strong className="font-mono text-emerald-700">
                    {formatVND(returnModalOrder.paidAmount)}
                  </strong>
                </div>
                <div className="text-sm font-extrabold text-rose-600 pt-1">
                  Còn phải thu: {formatVND(returnModalOrder.remainingAmount)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số tiền thu lúc trả đồ (VNĐ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(collectAmountInput)}
                  onChange={(e) =>
                    setCollectAmountInput(
                      Math.min(
                        returnModalOrder.remainingAmount,
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
                      onClick={() =>
                        setCollectMethod(pm.id as ServicePaymentMethod)
                      }
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

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnModalOrder(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
                >
                  Xác nhận Trả đồ & Thu tiền
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IN PHIẾU HẸN DỊCH VỤ */}
      {printOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-extrabold text-slate-900">
                Phiếu Hẹn Dịch Vụ — {printOrder.orderCode}
              </h3>
              <button
                type="button"
                onClick={() => setPrintOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div id="service-receipt-print-area" className="space-y-3 text-xs text-slate-800 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <div className="text-center border-b border-dashed border-slate-300 pb-2">
                <div className="font-extrabold text-base text-slate-900">
                  11 SPORT — PHIẾU NHẬN DỊCH VỤ
                </div>
                <div className="font-mono font-bold text-indigo-700 mt-0.5">
                  Mã phiếu: {printOrder.orderCode}
                </div>
              </div>

              <div className="space-y-1">
                <div>
                  Khách hàng: <strong>{printOrder.customerName}</strong>
                </div>
                <div>
                  Số điện thoại:{" "}
                  <strong className="font-mono">
                    {formatPhone(printOrder.customerPhone)}
                  </strong>
                </div>
                <div>
                  Ngày gửi: <strong>{formatShortDate(printOrder.receivedAt)}</strong>
                </div>
                <div>
                  Ngày hẹn trả:{" "}
                  <strong className="text-indigo-700">
                    {formatShortDate(printOrder.dueAt)}
                  </strong>
                </div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1.5">
                {(printOrder.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between gap-2">
                    <div>
                      <div className="font-bold">
                        {idx + 1}. {it.serviceName} ({it.quantity} {it.unit})
                      </div>
                      {it.itemNote && (
                        <div className="text-[11px] text-slate-600">
                          Ghi chú: {it.itemNote}
                        </div>
                      )}
                    </div>
                    <div className="font-mono font-bold shrink-0">
                      {formatVND(it.lineTotal)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-right">
                <div>
                  Tổng cộng:{" "}
                  <strong className="font-mono text-sm">
                    {formatVND(printOrder.totalAmount)}
                  </strong>
                </div>
                <div>
                  Đã thanh toán:{" "}
                  <strong className="font-mono text-emerald-700">
                    {formatVND(printOrder.paidAmount)}
                  </strong>
                </div>
                <div>
                  Còn phải thu khi nhận đồ:{" "}
                  <strong className="font-mono text-rose-600 text-sm">
                    {formatVND(printOrder.remainingAmount)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPrintOrder(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> In phiếu hẹn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
