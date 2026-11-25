import { apiRequest } from "@/shared/api/client";
import { DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from "@/config/listing";
import { useClientPagination } from "@/shared/hooks/useClientPagination";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { filterAndRankBySearch } from "@/shared/lib/search";
import { DebtOrderRow,Order,RevenueDashboardData } from "@/shared/types";
import { formatVND } from "@/shared/utils/format";
import { useCallback,useEffect,useMemo,useState } from "react";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export interface DebtManagementModuleProps {
  onOpenInvoice?: (order: Order) => void;
}

export function useDebtManagement({ onOpenInvoice }: DebtManagementModuleProps) {
  const [data, setData] = useState<RevenueDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const [debtTab, setDebtTab] = useState<"ORDERS" | "CUSTOMERS">("ORDERS");
  const [debtFilter, setDebtFilter] = useState<
    "HAS_DEBT" | "OVERDUE" | "UNPAID" | "PARTIAL" | "SETTLED" | "ALL"
  >("HAS_DEBT");
  const [debtSearch, setDebtSearch] = useState("");
  const [expandedCustomerPhone, setExpandedCustomerPhone] = useState<string | null>(null);

  // Modal Thu nợ / Tất toán (Dành cho Admin)
  const [debtPayModalOrder, setDebtPayModalOrder] = useState<DebtOrderRow | null>(null);
  const [debtPayAmount, setDebtPayAmount] = useState("");
  const [debtPayMethod, setDebtPayMethod] = useState<"BANKING" | "CASH" | "CARD">("BANKING");
  const [debtPayNote, setDebtPayNote] = useState("");
  const [debtPaySaving, setDebtPaySaving] = useState(false);
  const [debtPayError, setDebtPayError] = useState("");
  const [debtPaySuccessMsg, setDebtPaySuccessMsg] = useState("");

  const loadDebtData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<RevenueDashboardData>(API_ENDPOINTS.REPORTS.REVENUE_DASHBOARD);
      if (res.data) {
        setData(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDebtData();
  }, [loadDebtData]);

  const openDebtPayModal = (order: DebtOrderRow) => {
    setDebtPayModalOrder(order);
    setDebtPayAmount(String(order.debtAmount || 0));
    setDebtPayMethod("BANKING");
    setDebtPayNote("");
    setDebtPayError("");
  };

  const handleConfirmDebtPayment = async () => {
    if (!debtPayModalOrder) return;
    const amt = Math.round(Number(debtPayAmount) || 0);
    if (amt <= 0) {
      setDebtPayError("Vui lòng nhập số tiền thu nợ lớn hơn 0 VND.");
      return;
    }
    if (amt > debtPayModalOrder.debtAmount) {
      setDebtPayError(
        `Số tiền thu (${formatVND(amt)}) không được vượt quá dư nợ còn lại (${formatVND(
          debtPayModalOrder.debtAmount
        )}).`
      );
      return;
    }

    setDebtPaySaving(true);
    setDebtPayError("");
    try {
      const res = await apiRequest(API_ENDPOINTS.ORDERS.debtPayment(debtPayModalOrder._id), {
        method: "POST",
        body: JSON.stringify({
          amount: amt,
          method: debtPayMethod,
          note: debtPayNote.trim() || undefined,
        }),
      });
      setDebtPayModalOrder(null);
      setDebtPaySuccessMsg(
        (res as any).message ||
          `Đã ghi nhận thu nợ ${formatVND(amt)} cho đơn ${debtPayModalOrder.orderCode} thành công!`
      );
      setTimeout(() => setDebtPaySuccessMsg(""), 5000);
      await loadDebtData();
    } catch (err: any) {
      setDebtPayError(err.message || "Lỗi khi ghi nhận thu công nợ.");
    } finally {
      setDebtPaySaving(false);
    }
  };

  const handlePrintOrder = async (row: DebtOrderRow) => {
    if (!onOpenInvoice) return;
    try {
      const res = await apiRequest<Order>(API_ENDPOINTS.ORDERS.byId(row._id));
      if (res.data) {
        onOpenInvoice(res.data);
        return;
      }
    } catch {
      // fallback
    }
    onOpenInvoice({
      _id: row._id,
      orderCode: row.orderCode,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      items: row.items || [],
      subtotal: row.totalAmount,
      paymentMethod: (row.paymentMethod as any) || "OTHER",
      paymentMethodDetail: row.paymentMethodDetail,
      hasCardFee: false,
      cardFee: 0,
      totalAmount: row.totalAmount,
      paidAmount: row.paidAmount,
      debtAmount: row.debtAmount,
      initialDebtAmount: row.initialDebtAmount,
      debtStatus: row.debtStatus,
      debtDueDate: row.debtDueDate,
      debtPayments: row.debtPayments,
      note: row.note,
      status: "PAID",
      createdBy: "",
      createdByName: row.createdByName,
      confirmedByName: row.confirmedByName,
      createdAt: row.createdAt,
    });
  };

  const dm = data?.debtManagement;
  const s = data?.summary;

  const debouncedDebtSearch = useDebounce(debtSearch, DEBOUNCE_MS.LOCAL);

  const filteredDebtOrders = useMemo(() => {
    const list = dm?.orders || [];
    const byStatus = list.filter((o) => {
      if (debtFilter === "HAS_DEBT") return o.debtAmount > 0;
      if (debtFilter === "OVERDUE") return o.isOverdue && o.debtAmount > 0;
      if (debtFilter === "UNPAID") return o.debtStatus === "UNPAID" && o.debtAmount > 0;
      if (debtFilter === "PARTIAL") return o.debtStatus === "PARTIAL" && o.debtAmount > 0;
      if (debtFilter === "SETTLED") return o.debtStatus === "SETTLED" || o.debtAmount === 0;
      return true;
    });
    const q = debouncedDebtSearch.trim();
    if (!q) return byStatus;
    return filterAndRankBySearch(byStatus, q, (o) => [
      { text: o.orderCode, weight: 1.5 },
      { text: o.customerName, weight: 1.3 },
      { text: o.customerPhone, weight: 1.4 },
    ]);
  }, [dm?.orders, debtFilter, debouncedDebtSearch]);

  const filteredDebtCustomers = useMemo(() => {
    const list = dm?.customers || [];
    const byStatus = list.filter((c) => {
      if (debtFilter === "HAS_DEBT") return c.totalDebtAmount > 0;
      if (debtFilter === "OVERDUE") return c.overdueOrders > 0 && c.totalDebtAmount > 0;
      if (debtFilter === "SETTLED") return c.totalDebtAmount === 0;
      return true;
    });
    const q = debouncedDebtSearch.trim();
    if (!q) return byStatus;
    return filterAndRankBySearch(byStatus, q, (c) => [
      { text: c.customerName, weight: 1.4 },
      { text: c.phone, weight: 1.5 },
    ]);
  }, [dm?.customers, debtFilter, debouncedDebtSearch]);

  const ordersPagination = useClientPagination(filteredDebtOrders, DEFAULT_PAGE_SIZE);
  const customersPagination = useClientPagination(filteredDebtCustomers, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    ordersPagination.resetPage();
    customersPagination.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtFilter, debouncedDebtSearch]);


  return {
    onOpenInvoice,
    loading,
    debtTab,
    setDebtTab,
    debtFilter,
    setDebtFilter,
    debtSearch,
    setDebtSearch,
    expandedCustomerPhone,
    setExpandedCustomerPhone,
    debtPayModalOrder,
    setDebtPayModalOrder,
    debtPayAmount,
    setDebtPayAmount,
    debtPayMethod,
    setDebtPayMethod,
    debtPayNote,
    setDebtPayNote,
    debtPaySaving,
    debtPayError,
    debtPaySuccessMsg,
    loadDebtData,
    openDebtPayModal,
    handleConfirmDebtPayment,
    handlePrintOrder,
    dm,
    s,
    filteredDebtOrders,
    filteredDebtCustomers,
    ordersPagination,
    customersPagination,
  };
}

export type DebtManagementViewModel = ReturnType<typeof useDebtManagement>;
