import { apiRequest } from "@/shared/api/client";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { extractPagination } from "@/shared/api/pagination";
import { DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from "@/config/listing";
import { useClientPagination } from "@/shared/hooks/useClientPagination";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { ServiceOrder,ServiceOrdersMeta,ServiceOrderStatus,ServicePaymentMethod,ServiceType,StaffUser } from "@/shared/types";
import { cleanPhoneDigits,formatPhone,formatVND } from "@/shared/utils/format";
import React,{ useCallback,useEffect,useState } from "react";
const STATUS_INFO: Record<
  ServiceOrderStatus,
  { label: string; badgeCls: string }
> = {
  RECEIVED: {
    label: "Đã tiếp nhận",
    badgeCls: "bg-teal-50 text-brand-ink border-teal-200",
  },
  IN_PROGRESS: {
    label: "Đang xử lý",
    badgeCls: "bg-amber-50 text-amber-800 border-amber-300",
  },
  READY: {
    label: "Đã xong (Chờ lấy)",
    badgeCls: "bg-teal-50 text-brand-ink border-teal-300",
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


export function useServiceManagement({ currentUser }: { currentUser?: StaffUser | null }) {
  const isAccountantReadOnly = currentUser?.role === "ACCOUNTANT";
  const canManageServices = !isAccountantReadOnly;
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
  const debouncedOrderSearch = useDebounce(orderSearch, DEBOUNCE_MS.API);
  const debouncedTypeSearch = useDebounce(typeSearch, DEBOUNCE_MS.API);
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSizeState] = useState<number>(DEFAULT_PAGE_SIZE);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderTotalPages, setOrderTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Modal thu tiền / trả đồ
  const [collectOrder, setCollectOrder] = useState<ServiceOrder | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectMethod, setCollectMethod] = useState<ServicePaymentMethod>("CASH");
  const [collectHasCardFee, setCollectHasCardFee] = useState<boolean>(false);
  const [collectCardFeePercent, setCollectCardFeePercent] = useState<string>("1.8");
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

  const typePagination = useClientPagination(serviceTypes, DEFAULT_PAGE_SIZE);

  const fetchServiceTypes = useCallback(async () => {
    setLoadingTypes(true);
    try {
      const q = debouncedTypeSearch.trim()
        ? `?search=${encodeURIComponent(debouncedTypeSearch.trim())}`
        : "";
      const res = await apiRequest<ServiceType[]>(`${API_ENDPOINTS.SERVICES.TYPES}${q}`);
      setServiceTypes(res.data || []);
      typePagination.resetPage();
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi tải danh mục loại dịch vụ");
    } finally {
      setLoadingTypes(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTypeSearch]);

  useEffect(() => {
    setOrderPage(1);
  }, [debouncedOrderSearch, statusFilter, paymentFilter, overdueOnly, fromDate, toDate, orderPageSize]);

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
      params.set("page", String(orderPage));
      params.set("pageSize", String(orderPageSize));

      const qs = params.toString();
      const res = await apiRequest<ServiceOrder[]>(
        `${API_ENDPOINTS.SERVICES.ORDERS}${qs ? `?${qs}` : ""}`
      );
      const list = res.data || [];
      setServiceOrders(list);
      const pg = extractPagination(res.meta, list.length, orderPage, orderPageSize);
      setOrderTotal(pg.total);
      setOrderTotalPages(pg.totalPages);
      if (res.meta) {
        setOrdersMeta(res.meta as unknown as ServiceOrdersMeta);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi tải danh sách đơn dịch vụ");
    } finally {
      setLoadingOrders(false);
    }
  }, [debouncedOrderSearch, statusFilter, paymentFilter, overdueOnly, fromDate, toDate, orderPage, orderPageSize]);

  const setOrderPageSize = (sz: number) => {
    setOrderPageSizeState(sz);
    setOrderPage(1);
  };

  useEffect(() => {
    if (canManageServices) {
      fetchServiceTypes();
    }
  }, [canManageServices, fetchServiceTypes]);

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
        await apiRequest(API_ENDPOINTS.SERVICES.typeById(editingType._id), {
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
        await apiRequest(API_ENDPOINTS.SERVICES.TYPES, {
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
      await apiRequest(API_ENDPOINTS.SERVICES.typeById(st._id), {
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
      await apiRequest(API_ENDPOINTS.SERVICES.typeById(st._id), { method: "DELETE" });
      setSuccessMsg(`Đã xóa loại dịch vụ "${st.name}"`);
      fetchServiceTypes();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể xóa loại dịch vụ");
    }
  };

  // ==========================
  // HANDLERS: ĐƠN DỊCH VỤ (ADMIN CẬP NHẬT TRẠNG THÁI & THU TIỀN)
  // ==========================
  const handleStatusChange = async (
    order: ServiceOrder,
    nextStatus: ServiceOrderStatus
  ) => {
    if (nextStatus === "RETURNED" && order.remainingAmount > 0) {
      setCollectOrder(order);
      setCollectAmount(order.remainingAmount);
      const defaultPm = order.paymentMethod || "CASH";
      setCollectMethod(defaultPm);
      setCollectHasCardFee(defaultPm === "CARD");
      setCollectCardFeePercent("1.8");
      setCollectNote("Thu nốt tiền khi trả đồ cho khách");
      setMarkReturnedOnCollect(true);
      return;
    }
    setErrorMsg("");
    try {
      await apiRequest(API_ENDPOINTS.SERVICES.orderStatus(order._id), {
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
    const defaultPm = order.paymentMethod || "CASH";
    setCollectMethod(defaultPm);
    setCollectHasCardFee(defaultPm === "CARD");
    setCollectCardFeePercent("1.8");
    setCollectNote(
      markReturned ? "Thu tiền khi trả đồ cho khách" : "Thu thêm tiền đơn dịch vụ"
    );
    setMarkReturnedOnCollect(markReturned);
  };

  const handleSubmitCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectOrder) return;
    setErrorMsg("");
    const useCardFee = collectMethod === "CARD";
    const pct = useCardFee ? Math.max(0, Number(collectCardFeePercent) || 0) : 0;
    try {
      if (markReturnedOnCollect) {
        await apiRequest(API_ENDPOINTS.SERVICES.orderStatus(collectOrder._id), {
          method: "PATCH",
          body: JSON.stringify({
            status: "RETURNED",
            collectAmount,
            paymentMethod: collectMethod,
            hasCardFee: useCardFee,
            cardFeePercent: pct,
            paymentNote: collectNote.trim(),
          }),
        });
        setSuccessMsg(
          `Đã trả đồ & thu tiền cho đơn ${collectOrder.orderCode}`
        );
      } else {
        await apiRequest(API_ENDPOINTS.SERVICES.orderPayments(collectOrder._id), {
          method: "POST",
          body: JSON.stringify({
            amount: collectAmount,
            method: collectMethod,
            hasCardFee: useCardFee,
            cardFeePercent: pct,
            note: collectNote.trim(),
          }),
        });
        setSuccessMsg(
          `Đã ghi nhận thu tiền cho đơn ${collectOrder.orderCode}`
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
      await apiRequest(API_ENDPOINTS.SERVICES.orderById(editingOrder._id), {
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


  return {
    isAccountantReadOnly,
    canManageServices,
    subTab,
    setSubTab,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    serviceTypes,
    loadingTypes,
    typeSearch,
    setTypeSearch,
    editingType,
    setEditingType,
    typeCode,
    setTypeCode,
    typeName,
    setTypeName,
    typeDefaultPrice,
    setTypeDefaultPrice,
    typeUnit,
    setTypeUnit,
    typeDesc,
    setTypeDesc,
    savingType,
    serviceOrders,
    ordersMeta,
    loadingOrders,
    orderSearch,
    setOrderSearch,
    statusFilter,
    setStatusFilter,
    paymentFilter,
    setPaymentFilter,
    overdueOnly,
    setOverdueOnly,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    collectOrder,
    setCollectOrder,
    collectAmount,
    setCollectAmount,
    collectMethod,
    setCollectMethod,
    setCollectHasCardFee,
    collectCardFeePercent,
    setCollectCardFeePercent,
    collectNote,
    setCollectNote,
    markReturnedOnCollect,
    editingOrder,
    setEditingOrder,
    editCustomerName,
    setEditCustomerName,
    editCustomerPhone,
    setEditCustomerPhone,
    editReceivedDate,
    setEditReceivedDate,
    editDueDate,
    setEditDueDate,
    editNote,
    setEditNote,
    editStatus,
    setEditStatus,
    editItems,
    setEditItems,
    savingOrderEdit,
    fetchServiceOrders,
    resetTypeForm,
    handleSaveServiceType,
    handleToggleTypeStatus,
    handleDeleteType,
    handleStatusChange,
    handleOpenCollectModal,
    handleSubmitCollect,
    handleOpenEditOrder,
    handleSaveOrderEdit,
    pagedServiceTypes: typePagination.items,
    typePage: typePagination.page,
    typePageSize: typePagination.pageSize,
    typeTotal: typePagination.total,
    typeTotalPages: typePagination.totalPages,
    setTypePage: typePagination.setPage,
    setTypePageSize: typePagination.setPageSize,
    orderPage,
    orderPageSize,
    orderTotal,
    orderTotalPages,
    setOrderPage,
    setOrderPageSize,
  };
}

export type ServiceManagementViewModel = ReturnType<typeof useServiceManagement>;
