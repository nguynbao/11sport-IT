"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  useDebounce,
} from "@/lib/api";
import {
  Wrench,
  Plus,
  Edit3,
  Trash2,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  Wallet,
  PackageCheck,
  Play,
  X,
  Power,
  ListChecks,
  Layers,
} from "lucide-react";

const STATUS_INFO: Record<
  ServiceOrderStatus,
  { label: string; badgeCls: string }
> = {
  RECEIVED: {
    label: "Đã nhận đồ",
    badgeCls: "bg-sky-50 text-sky-700 border-sky-200",
  },
  IN_PROGRESS: {
    label: "Đang xử lý",
    badgeCls: "bg-amber-50 text-amber-800 border-amber-300",
  },
  READY: {
    label: "Đã xong (Chờ lấy)",
    badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-300",
  },
  RETURNED: {
    label: "Đã trả khách",
    badgeCls: "bg-slate-100 text-slate-700 border-slate-300",
  },
  CANCELLED: {
    label: "Đã hủy",
    badgeCls: "bg-red-50 text-red-600 border-red-200",
  },
};

function formatDateDisplay(raw?: string | null): string {
  if (!raw) return "—";
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toInputDate(raw?: string | null): string {
  if (!raw) return "";
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ServiceManagementModule() {
  const [subTab, setSubTab] = useState<"ORDERS" | "TYPES">("ORDERS");

  // Thông báo chung
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ==========================
  // STATE: LOẠI DỊCH VỤ (TYPES)
  // ==========================
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");

  // Form tạo / sửa loại dịch vụ
  const [editingType, setEditingType] = useState<ServiceType | null>(null);
  const [typeCode, setTypeCode] = useState("");
  const [typeName, setTypeName] = useState("");
  const [typeDefaultPrice, setTypeDefaultPrice] = useState<number>(40000);
  const [typeUnit, setTypeUnit] = useState("Cây");
  const [typeDesc, setTypeDesc] = useState("");
  const [savingType, setSavingType] = useState(false);

  // ==========================
  // STATE: ĐƠN DỊCH VỤ (ORDERS)
  // ==========================
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
  const debouncedOrderSearch = useDebounce(orderSearch, 250);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Modal thu tiền / trả đồ
  const [collectOrder, setCollectOrder] = useState<ServiceOrder | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectMethod, setCollectMethod] = useState<ServicePaymentMethod>("CASH");
  const [collectNote, setCollectNote] = useState<string>("");
  const [markReturnedOnCollect, setMarkReturnedOnCollect] = useState<boolean>(false);

  // Modal chỉnh sửa đơn dịch vụ
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editReceivedDate, setEditReceivedDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editStatus, setEditStatus] = useState<ServiceOrderStatus>("RECEIVED");
  const [editItems, setEditItems] = useState<
    {
      serviceTypeId: string;
      serviceCode: string;
      serviceName: string;
      unit: string;
      defaultPrice: number;
      unitPrice: number;
      quantity: number;
      itemNote: string;
    }[]
  >([]);
  const [savingOrderEdit, setSavingOrderEdit] = useState(false);

  const fetchServiceTypes = useCallback(async () => {
    setLoadingTypes(true);
    try {
      const q = typeSearch.trim()
        ? `?search=${encodeURIComponent(typeSearch.trim())}`
        : "";
      const res = await apiRequest<ServiceType[]>(`/service-types${q}`);
      setServiceTypes(res.data || []);
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi tải danh mục loại dịch vụ");
    } finally {
      setLoadingTypes(false);
    }
  }, [typeSearch]);

  const fetchServiceOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const params = new URLSearchParams();
      if (debouncedOrderSearch.trim()) {
        params.set("search", debouncedOrderSearch.trim());
      }
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (paymentFilter !== "ALL") {
        params.set("paymentStatus", paymentFilter);
      }
      if (overdueOnly) {
        params.set("overdueOnly", "true");
      }
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const qs = params.toString();
      const res = await apiRequest<ServiceOrder[]>(
        `/service-orders${qs ? `?${qs}` : ""}`
      );
      setServiceOrders(res.data || []);
      if (res.meta) {
        setOrdersMeta(res.meta as unknown as ServiceOrdersMeta);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi tải danh sách đơn dịch vụ");
    } finally {
      setLoadingOrders(false);
    }
  }, [debouncedOrderSearch, statusFilter, paymentFilter, overdueOnly, fromDate, toDate]);

  useEffect(() => {
    fetchServiceTypes();
  }, [fetchServiceTypes]);

  useEffect(() => {
    fetchServiceOrders();
  }, [fetchServiceOrders]);

  // ==========================
  // HANDLERS: LOẠI DỊCH VỤ
  // ==========================
  const resetTypeForm = () => {
    setEditingType(null);
    setTypeCode("");
    setTypeName("");
    setTypeDefaultPrice(40000);
    setTypeUnit("Cây");
    setTypeDesc("");
  };

  const handleSaveServiceType = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!typeName.trim()) {
      setErrorMsg("Vui lòng nhập Tên loại dịch vụ.");
      return;
    }

    setSavingType(true);
    try {
      if (editingType) {
        await apiRequest(`/service-types/${editingType._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: typeName.trim(),
            defaultPrice: typeDefaultPrice,
            unit: typeUnit.trim() || "Cây",
            description: typeDesc.trim(),
          }),
        });
        setSuccessMsg(`Đã cập nhật loại dịch vụ "${typeName.trim()}"`);
      } else {
        await apiRequest("/service-types", {
          method: "POST",
          body: JSON.stringify({
            code: typeCode.trim() || undefined,
            name: typeName.trim(),
            defaultPrice: typeDefaultPrice,
            unit: typeUnit.trim() || "Cây",
            description: typeDesc.trim(),
            status: "ACTIVE",
          }),
        });
        setSuccessMsg(`Đã tạo loại dịch vụ mới "${typeName.trim()}"`);
      }
      resetTypeForm();
      fetchServiceTypes();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể lưu loại dịch vụ");
    } finally {
      setSavingType(false);
    }
  };

  const handleToggleTypeStatus = async (st: ServiceType) => {
    const nextStatus = st.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setErrorMsg("");
    try {
      await apiRequest(`/service-types/${st._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccessMsg(
        `Đã chuyển "${st.name}" sang trạng thái ${
          nextStatus === "ACTIVE" ? "Đang hoạt động" : "Ngừng sử dụng"
        }`
      );
      fetchServiceTypes();
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi đổi trạng thái loại dịch vụ");
    }
  };

  const handleDeleteType = async (st: ServiceType) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Xóa loại dịch vụ "${st.name}"?`)
    ) {
      return;
    }
    setErrorMsg("");
    try {
      await apiRequest(`/service-types/${st._id}`, { method: "DELETE" });
      setSuccessMsg(`Đã xóa loại dịch vụ "${st.name}"`);
      fetchServiceTypes();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể xóa loại dịch vụ");
    }
  };

  // ==========================
  // HANDLERS: ĐƠN DỊCH VỤ
  // ==========================
  const handleStatusChange = async (
    order: ServiceOrder,
    nextStatus: ServiceOrderStatus
  ) => {
    if (nextStatus === "RETURNED" && order.remainingAmount > 0) {
      setCollectOrder(order);
      setCollectAmount(order.remainingAmount);
      setCollectMethod(order.paymentMethod || "CASH");
      setCollectNote("Thu nốt tiền khi trả đồ cho khách");
      setMarkReturnedOnCollect(true);
      return;
    }
    setErrorMsg("");
    try {
      await apiRequest(`/service-orders/${order._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccessMsg(
        `Đã chuyển đơn ${order.orderCode} sang "${STATUS_INFO[nextStatus].label}"`
      );
      fetchServiceOrders();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể đổi trạng thái đơn dịch vụ");
    }
  };

  const handleOpenCollectModal = (order: ServiceOrder, markReturned = false) => {
    setCollectOrder(order);
    setCollectAmount(order.remainingAmount);
    setCollectMethod(order.paymentMethod || "CASH");
    setCollectNote(
      markReturned ? "Thu tiền khi trả đồ cho khách" : "Thu thêm tiền đơn dịch vụ"
    );
    setMarkReturnedOnCollect(markReturned);
  };

  const handleSubmitCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectOrder) return;
    setErrorMsg("");
    try {
      if (markReturnedOnCollect) {
        await apiRequest(`/service-orders/${collectOrder._id}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "RETURNED",
            collectAmount,
            paymentMethod: collectMethod,
            paymentNote: collectNote.trim(),
          }),
        });
        setSuccessMsg(
          `Đã trả đồ & thu ${formatVND(collectAmount)} cho đơn ${collectOrder.orderCode}`
        );
      } else {
        await apiRequest(`/service-orders/${collectOrder._id}/payments`, {
          method: "POST",
          body: JSON.stringify({
            amount: collectAmount,
            method: collectMethod,
            note: collectNote.trim(),
          }),
        });
        setSuccessMsg(
          `Đã ghi nhận thu ${formatVND(collectAmount)} cho đơn ${collectOrder.orderCode}`
        );
      }
      setCollectOrder(null);
      fetchServiceOrders();
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi thu tiền đơn dịch vụ");
    }
  };

  const handleOpenEditOrder = (order: ServiceOrder) => {
    setEditingOrder(order);
    setEditCustomerName(order.customerName);
    setEditCustomerPhone(formatPhone(order.customerPhone));
    setEditReceivedDate(toInputDate(order.receivedAt));
    setEditDueDate(toInputDate(order.dueAt));
    setEditNote(order.note || "");
    setEditStatus(order.status);
    setEditItems(
      (order.items || []).map((it) => ({
        serviceTypeId: it.serviceTypeId || "",
        serviceCode: it.serviceCode,
        serviceName: it.serviceName,
        unit: it.unit || "Cây",
        defaultPrice: it.defaultPrice || it.unitPrice,
        unitPrice: it.unitPrice,
        quantity: it.quantity || 1,
        itemNote: it.itemNote || "",
      }))
    );
  };

  const handleSaveOrderEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setErrorMsg("");

    const newTotal = editItems.reduce(
      (sum, it) => sum + Math.max(0, Number(it.unitPrice) || 0) * Math.max(1, Number(it.quantity) || 1),
      0
    );
    const currentPaid = Number(editingOrder.paidAmount) || 0;
    if (newTotal < currentPaid) {
      setErrorMsg(
        `Tổng tiền mới (${formatVND(newTotal)}) không được nhỏ hơn số tiền khách đã thanh toán (${formatVND(currentPaid)}).`
      );
      return;
    }

    setSavingOrderEdit(true);
    try {
      await apiRequest(`/service-orders/${editingOrder._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          customerName: editCustomerName.trim(),
          customerPhone: cleanPhoneDigits(editCustomerPhone),
          receivedAt: editReceivedDate,
          dueAt: editDueDate,
          status: editStatus,
          note: editNote.trim(),
          items: editItems,
        }),
      });
      setSuccessMsg(`Đã cập nhật thông tin đơn dịch vụ ${editingOrder.orderCode}`);
      setEditingOrder(null);
      fetchServiceOrders();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể cập nhật đơn dịch vụ");
    } finally {
      setSavingOrderEdit(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* HEADER & CHUYỂN TAB */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">
              Quản Lý Dịch Vụ & Đơn Dịch Vụ
            </h1>
            <p className="text-xs text-slate-500">
              Tạo danh mục loại dịch vụ (giá mặc định) và theo dõi toàn bộ đơn dịch vụ khách gửi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab("ORDERS")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition ${
              subTab === "ORDERS"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <ListChecks className="w-4 h-4" />
            <span>Quản lý Đơn Dịch Vụ ({ordersMeta.totalOrders})</span>
            {ordersMeta.overdueCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-red-600 text-white">
                {ordersMeta.overdueCount} quá hạn
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab("TYPES")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition ${
              subTab === "TYPES"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Danh mục Loại Dịch Vụ ({serviceTypes.length})</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg("")} className="text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================================================== */}
      {/* TAB 1: QUẢN LÝ ĐƠN DỊCH VỤ */}
      {/* ================================================== */}
      {subTab === "ORDERS" && (
        <div className="space-y-4">
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-500">Tổng đơn dịch vụ</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {ordersMeta.totalOrders}
              </div>
            </div>
            <div className="bg-sky-50 p-3.5 rounded-xl border border-sky-200">
              <div className="text-xs font-bold text-sky-700">Đã nhận / Đang xử lý</div>
              <div className="text-xl font-extrabold text-sky-900 mt-1">
                {ordersMeta.receivedCount + ordersMeta.inProgressCount}
              </div>
            </div>
            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
              <div className="text-xs font-bold text-emerald-700">Đã xong (Chờ lấy)</div>
              <div className="text-xl font-extrabold text-emerald-900 mt-1">
                {ordersMeta.readyCount}
              </div>
            </div>
            <div className="bg-red-50 p-3.5 rounded-xl border border-red-200">
              <div className="text-xs font-bold text-red-700 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Quá hạn hẹn trả
              </div>
              <div className="text-xl font-extrabold text-red-700 mt-1">
                {ordersMeta.overdueCount}
              </div>
            </div>
            <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200">
              <div className="text-xs font-bold text-indigo-700">Tổng doanh thu DV</div>
              <div className="text-base font-mono font-extrabold text-indigo-900 mt-1">
                {formatVND(ordersMeta.totalRevenue)}
              </div>
            </div>
            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200">
              <div className="text-xs font-bold text-amber-800">Còn phải thu KH</div>
              <div className="text-base font-mono font-extrabold text-rose-600 mt-1">
                {formatVND(ordersMeta.totalRemaining)}
              </div>
            </div>
          </div>

          {/* BỘ LỌC & BẢNG ĐƠN DỊCH VỤ */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Tìm kiếm đơn dịch vụ
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Mã DV-0001, tên khách, SĐT, loại dịch vụ..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Trạng thái xử lý
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="RECEIVED">Đã nhận đồ</option>
                  <option value="IN_PROGRESS">Đang xử lý</option>
                  <option value="READY">Đã xong (Chờ lấy)</option>
                  <option value="RETURNED">Đã trả khách</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Thanh toán
                </label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="UNPAID">Chưa thu (0đ)</option>
                  <option value="PARTIAL">Đã đặt cọc</option>
                  <option value="PAID">Đã thu đủ</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Từ ngày gửi
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Đến ngày gửi
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchServiceOrders}
                  className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700"
                  title="Làm mới"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOrders ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOverdueOnly((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition ${
                  overdueOnly
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Chỉ hiện đơn Quá hạn hẹn trả ({ordersMeta.overdueCount})
              </button>

              {(statusFilter !== "ALL" ||
                paymentFilter !== "ALL" ||
                overdueOnly ||
                fromDate ||
                toDate ||
                orderSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("ALL");
                    setPaymentFilter("ALL");
                    setOverdueOnly(false);
                    setFromDate("");
                    setToDate("");
                    setOrderSearch("");
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>

            {/* BẢNG DANH SÁCH */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase font-extrabold">
                    <th className="py-3 px-3">Mã đơn</th>
                    <th className="py-3 px-3">Khách hàng</th>
                    <th className="py-3 px-3">Chi tiết dịch vụ</th>
                    <th className="py-3 px-3">Ngày gửi / Hẹn trả</th>
                    <th className="py-3 px-3 text-right">Tổng tiền / Thanh toán</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loadingOrders ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        Đang tải danh sách đơn dịch vụ...
                      </td>
                    </tr>
                  ) : serviceOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        Chưa có đơn dịch vụ nào khớp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    serviceOrders.map((ord) => {
                      const stInfo = STATUS_INFO[ord.status] || STATUS_INFO.RECEIVED;
                      return (
                        <tr
                          key={ord._id}
                          className={`hover:bg-slate-50/80 ${
                            ord.isOverdue ? "bg-red-50/40" : ""
                          }`}
                        >
                          <td className="py-3 px-3 align-top">
                            <span className="font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {ord.orderCode}
                            </span>
                            {ord.createdByName && (
                              <div className="text-[11px] text-slate-400 mt-1">
                                NV: {ord.createdByName}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top">
                            <div className="font-extrabold text-slate-900">
                              {ord.customerName}
                            </div>
                            <div className="font-mono text-slate-600 mt-0.5">
                              {formatPhone(ord.customerPhone)}
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top max-w-xs">
                            <div className="space-y-1">
                              {(ord.items || []).map((it, idx) => (
                                <div key={idx}>
                                  <span className="font-bold text-slate-900">
                                    • {it.serviceName}
                                  </span>{" "}
                                  <span className="text-slate-500">
                                    ({it.quantity} {it.unit} × {formatVND(it.unitPrice)})
                                  </span>
                                  {it.itemNote && (
                                    <div className="text-[11px] text-indigo-700 pl-2">
                                      ↳ {it.itemNote}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {ord.note && (
                                <div className="text-[11px] text-slate-500 italic">
                                  Ghi chú: {ord.note}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <div>
                              Gửi: <strong>{formatDateDisplay(ord.receivedAt)}</strong>
                            </div>
                            <div
                              className={`mt-0.5 ${
                                ord.isOverdue ? "text-red-600 font-extrabold" : ""
                              }`}
                            >
                              Hẹn trả: <strong>{formatDateDisplay(ord.dueAt)}</strong>
                            </div>
                            {ord.returnedAt && (
                              <div className="text-[11px] text-emerald-700 mt-0.5">
                                Đã trả: {formatDateDisplay(ord.returnedAt)}
                              </div>
                            )}
                            {ord.isOverdue && (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-extrabold">
                                <AlertTriangle className="w-3 h-3" /> Quá hạn hẹn trả
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                            <div className="font-mono font-extrabold text-sm text-slate-900">
                              {formatVND(ord.totalAmount)}
                            </div>
                            <div className="text-[11px] text-emerald-700 font-mono">
                              Đã thu: {formatVND(ord.paidAmount)}
                            </div>
                            {ord.remainingAmount > 0 ? (
                              <div className="text-[11px] font-mono font-extrabold text-rose-600">
                                Còn thu: {formatVND(ord.remainingAmount)}
                              </div>
                            ) : (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                Đã thanh toán đủ
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top">
                            <select
                              value={ord.status}
                              onChange={(e) =>
                                handleStatusChange(
                                  ord,
                                  e.target.value as ServiceOrderStatus
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${stInfo.badgeCls}`}
                            >
                              <option value="RECEIVED">Đã nhận đồ</option>
                              <option value="IN_PROGRESS">Đang xử lý</option>
                              <option value="READY">Đã xong (Chờ lấy)</option>
                              <option value="RETURNED">Đã trả khách</option>
                              <option value="CANCELLED">Đã hủy</option>
                            </select>
                          </td>

                          <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {ord.remainingAmount > 0 &&
                                ord.status !== "CANCELLED" && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCollectModal(ord, false)}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1"
                                    title="Thu tiền dịch vụ"
                                  >
                                    <Wallet className="w-3.5 h-3.5" /> Thu tiền
                                  </button>
                                )}

                              {ord.status !== "RETURNED" &&
                                ord.status !== "CANCELLED" && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(ord, "RETURNED")}
                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1"
                                    title="Xác nhận trả đồ cho khách"
                                  >
                                    <PackageCheck className="w-3.5 h-3.5" /> Trả đồ
                                  </button>
                                )}

                              <button
                                type="button"
                                onClick={() => handleOpenEditOrder(ord)}
                                className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700"
                                title="Chỉnh sửa đơn dịch vụ"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* TAB 2: DANH MỤC LOẠI DỊCH VỤ */}
      {/* ================================================== */}
      {subTab === "TYPES" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* FORM TẠO / SỬA LOẠI DỊCH VỤ */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-base font-extrabold text-slate-900 pb-3 border-b border-slate-100">
                {editingType
                  ? `Chỉnh sửa: ${editingType.name}`
                  : "Tạo Loại Dịch Vụ Mới"}
              </h2>

              <form onSubmit={handleSaveServiceType} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên loại dịch vụ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    placeholder="VD: Đan vợt / Căng vợt cầu lông"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {!editingType && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mã dịch vụ (Tự sinh nếu để trống)
                    </label>
                    <input
                      type="text"
                      value={typeCode}
                      onChange={(e) => setTypeCode(e.target.value.toUpperCase())}
                      placeholder="VD: DV_DAN_VOT"
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Giá mặc định (VNĐ) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberDots(typeDefaultPrice)}
                      onChange={(e) =>
                        setTypeDefaultPrice(parseNumberDots(e.target.value))
                      }
                      className="w-full px-3 py-2 text-sm font-mono font-extrabold text-indigo-700 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Đơn vị tính
                    </label>
                    <input
                      type="text"
                      value={typeUnit}
                      onChange={(e) => setTypeUnit(e.target.value)}
                      placeholder="Cây / Đôi / Lần"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mô tả / Ghi chú
                  </label>
                  <textarea
                    rows={3}
                    value={typeDesc}
                    onChange={(e) => setTypeDesc(e.target.value)}
                    placeholder="Mô tả quy chuẩn dịch vụ..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {editingType && (
                    <button
                      type="button"
                      onClick={resetTypeForm}
                      className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                    >
                      Hủy sửa
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingType}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    {editingType ? "Lưu cập nhật" : "Tạo Loại Dịch Vụ"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* BẢNG DANH SÁCH LOẠI DỊCH VỤ */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Danh Sách Loại Dịch Vụ ({serviceTypes.length})
                </h2>
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={typeSearch}
                    onChange={(e) => setTypeSearch(e.target.value)}
                    placeholder="Tìm mã hoặc tên dịch vụ..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase font-extrabold">
                      <th className="py-3 px-3">Mã DV</th>
                      <th className="py-3 px-3">Tên loại dịch vụ</th>
                      <th className="py-3 px-3 text-right">Giá mặc định</th>
                      <th className="py-3 px-3 text-center">ĐVT</th>
                      <th className="py-3 px-3 text-center">Số đơn</th>
                      <th className="py-3 px-3">Trạng thái</th>
                      <th className="py-3 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingTypes ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Đang tải danh mục dịch vụ...
                        </td>
                      </tr>
                    ) : serviceTypes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Chưa có loại dịch vụ nào.
                        </td>
                      </tr>
                    ) : (
                      serviceTypes.map((st) => (
                        <tr key={st._id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-mono font-bold text-slate-700">
                            {st.code}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-slate-900">
                              {st.name}
                            </div>
                            {st.description && (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {st.description}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-indigo-700">
                            {formatVND(st.defaultPrice)}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-600">
                            {st.unit || "Cây"}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {st.orderCount || 0}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                st.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                              }`}
                            >
                              {st.status === "ACTIVE"
                                ? "Đang hoạt động"
                                : "Ngừng sử dụng"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingType(st);
                                  setTypeCode(st.code);
                                  setTypeName(st.name);
                                  setTypeDefaultPrice(st.defaultPrice);
                                  setTypeUnit(st.unit || "Cây");
                                  setTypeDesc(st.description || "");
                                }}
                                className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700"
                                title="Sửa loại dịch vụ"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleTypeStatus(st)}
                                className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700"
                                title={
                                  st.status === "ACTIVE"
                                    ? "Ngừng sử dụng"
                                    : "Kích hoạt lại"
                                }
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteType(st)}
                                className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                                title="Xóa loại dịch vụ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THU TIỀN / TRẢ ĐỒ */}
      {collectOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                {markReturnedOnCollect
                  ? `Trả Đồ & Thu Tiền (${collectOrder.orderCode})`
                  : `Thu Tiền Đơn Dịch Vụ (${collectOrder.orderCode})`}
              </h3>
              <button
                type="button"
                onClick={() => setCollectOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCollect} className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>
                  Khách hàng: <strong>{collectOrder.customerName}</strong> (
                  {formatPhone(collectOrder.customerPhone)})
                </div>
                <div>
                  Tổng tiền:{" "}
                  <strong className="font-mono">
                    {formatVND(collectOrder.totalAmount)}
                  </strong>{" "}
                  • Đã thu:{" "}
                  <strong className="font-mono text-emerald-700">
                    {formatVND(collectOrder.paidAmount)}
                  </strong>
                </div>
                <div className="text-sm font-extrabold text-rose-600 pt-1">
                  Còn phải thu: {formatVND(collectOrder.remainingAmount)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số tiền thu lần này (VNĐ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(collectAmount)}
                  onChange={(e) =>
                    setCollectAmount(
                      Math.min(
                        collectOrder.remainingAmount,
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
                  onClick={() => setCollectOrder(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHỈNH SỬA ĐƠN DỊCH VỤ */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                Chỉnh Sửa Đơn Dịch Vụ — {editingOrder.orderCode}
              </h3>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrderEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tên khách hàng *
                  </label>
                  <input
                    type="text"
                    required
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Số điện thoại *
                  </label>
                  <input
                    type="text"
                    required
                    value={editCustomerPhone}
                    onChange={(e) =>
                      setEditCustomerPhone(formatPhone(e.target.value))
                    }
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Ngày gửi *
                  </label>
                  <input
                    type="date"
                    required
                    value={editReceivedDate}
                    onChange={(e) => setEditReceivedDate(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Ngày hẹn trả *
                  </label>
                  <input
                    type="date"
                    required
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as ServiceOrderStatus)
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="RECEIVED">Đã nhận đồ</option>
                    <option value="IN_PROGRESS">Đang xử lý</option>
                    <option value="READY">Đã xong (Chờ lấy)</option>
                    <option value="RETURNED">Đã trả khách</option>
                    <option value="CANCELLED">Đã hủy</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="block font-bold text-slate-700">
                  Hạng mục dịch vụ & Giá
                </label>
                {editItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="font-bold text-slate-900">
                      #{idx + 1}. {it.serviceName}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-500">
                          Đơn giá (VNĐ)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberDots(it.unitPrice)}
                          onChange={(e) => {
                            const val = parseNumberDots(e.target.value);
                            setEditItems((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, unitPrice: val } : row
                              )
                            );
                          }}
                          className="w-full px-2.5 py-1.5 font-mono font-bold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500">
                          Số lượng ({it.unit})
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setEditItems((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, quantity: val } : row
                              )
                            );
                          }}
                          className="w-full px-2.5 py-1.5 font-mono font-bold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={it.itemNote}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, itemNote: val } : row
                          )
                        );
                      }}
                      placeholder="Ghi chú đồ gửi..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ghi chú đơn
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              {(() => {
                const newTotal = editItems.reduce(
                  (sum, it) =>
                    sum +
                    Math.max(0, Number(it.unitPrice) || 0) *
                      Math.max(1, Number(it.quantity) || 1),
                  0
                );
                const paid = Number(editingOrder.paidAmount) || 0;
                const belowPaid = newTotal < paid;
                return (
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                      belowPaid
                        ? "bg-red-50 border-red-300 text-red-700"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div>
                      Tổng mới:{" "}
                      <strong className="font-mono">{formatVND(newTotal)}</strong>{" "}
                      • Đã thu:{" "}
                      <strong className="font-mono text-emerald-700">
                        {formatVND(paid)}
                      </strong>
                    </div>
                    {belowPaid && (
                      <span className="font-extrabold text-red-600">
                        ⚠️ Không được giảm tổng thấp hơn số tiền đã thu!
                      </span>
                    )}
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 font-bold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingOrderEdit}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold"
                >
                  {savingOrderEdit ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
