import { useState, useEffect, useCallback, useMemo } from "react";
import { Order, ReturnReceipt } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { extractPagination } from "@/shared/api/pagination";
import { DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from "@/config/listing";
import { formatVND } from "@/shared/utils/format";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { filterAndRankBySearch } from "@/shared/lib/search";

export function useOrdersReturns({ onOpenInvoice }: { onOpenInvoice: (order: Order) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnReceipt[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [debtFilter, setDebtFilter] = useState("");
  const [returnTypeFilter, setReturnTypeFilter] = useState("");
  const [ordPage, setOrdPage] = useState(1);
  const [ordPageSize, setOrdPageSizeState] = useState<number>(DEFAULT_PAGE_SIZE);
  const [ordTotal, setOrdTotal] = useState(0);
  const [ordTotalPages, setOrdTotalPages] = useState(1);
  const [retPage, setRetPage] = useState(1);
  const [retPageSize, setRetPageSizeState] = useState<number>(DEFAULT_PAGE_SIZE);
  const [retTotal, setRetTotal] = useState(0);
  const [retTotalPages, setRetTotalPages] = useState(1);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Debounce từ khóa tìm kiếm (400ms) để tránh gọi API liên tục trên từng phím gõ
  const debouncedSearch = useDebounce(search, DEBOUNCE_MS.API);

  useEffect(() => {
    setOrdPage(1);
    setRetPage(1);
  }, [debouncedSearch, statusFilter, paymentFilter, debtFilter]);

  const loadData = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (debouncedSearch.trim()) q.set("search", debouncedSearch.trim());
      if (statusFilter) q.set("status", statusFilter);
      if (paymentFilter) q.set("paymentMethod", paymentFilter);
      if (debtFilter) q.set("debtStatus", debtFilter);
      q.set("page", String(ordPage));
      q.set("pageSize", String(ordPageSize));

      const retQ = new URLSearchParams();
      if (debouncedSearch.trim()) retQ.set("search", debouncedSearch.trim());
      if (returnTypeFilter) retQ.set("type", returnTypeFilter);
      retQ.set("page", String(retPage));
      retQ.set("pageSize", String(retPageSize));

      const [ordRes, retRes] = await Promise.all([
        apiRequest<Order[]>(`${API_ENDPOINTS.ORDERS.BASE}?${q.toString()}`),
        apiRequest<ReturnReceipt[]>(
          `${API_ENDPOINTS.RETURNS.BASE}?${retQ.toString()}`
        ),
      ]);
      const ordList = Array.isArray(ordRes.data) ? ordRes.data : [];
      const retList = Array.isArray(retRes.data) ? retRes.data : [];
      setOrders(ordList);
      setReturns(retList);

      const ordPg = extractPagination(ordRes.meta, ordList.length, ordPage, ordPageSize);
      setOrdTotal(ordPg.total);
      setOrdTotalPages(ordPg.totalPages);

      const retPg = extractPagination(retRes.meta, retList.length, retPage, retPageSize);
      setRetTotal(retPg.total);
      setRetTotalPages(retPg.totalPages);
    } catch {
      // ignore
    }
  }, [debouncedSearch, statusFilter, paymentFilter, debtFilter, returnTypeFilter, ordPage, ordPageSize, retPage, retPageSize]);

  const setOrdPageSize = (sz: number) => {
    setOrdPageSizeState(sz);
    setOrdPage(1);
  };
  const setRetPageSize = (sz: number) => {
    setRetPageSizeState(sz);
    setRetPage(1);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirmDraft = async (ord: Order) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Xác nhận chốt thanh toán cho hóa đơn nháp ${ord.orderCode || ord.code} (${formatVND(
          ord.totalAmount
        )})? Hệ thống sẽ thực hiện trừ tồn Kho Tầng 1.`
      )
    ) {
      return;
    }
    setActionMsg(null);
    try {
      const res = await apiRequest<Order>(`${API_ENDPOINTS.ORDERS.byId(ord._id)}/confirm`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setActionMsg({
        type: "success",
        text: `Đã chốt thanh toán hóa đơn ${res.data.orderCode} và trừ tồn Kho Tầng 1 thành công!`,
      });
      loadData();
      onOpenInvoice(res.data);
    } catch (err: any) {
      setActionMsg({
        type: "error",
        text: err?.message || "Không thể chốt thanh toán hóa đơn nháp.",
      });
    }
  };

  const handleDeleteDraft = async (ord: Order) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Xóa hóa đơn nháp ${ord.orderCode || ord.code}?`)
    ) {
      return;
    }
    setActionMsg(null);
    try {
      await apiRequest(API_ENDPOINTS.ORDERS.byId(ord._id), { method: "DELETE" });
      setActionMsg({
        type: "success",
        text: `Đã xóa hóa đơn nháp ${ord.orderCode || ord.code}.`,
      });
      loadData();
    } catch (err: any) {
      setActionMsg({
        type: "error",
        text: err?.message || "Không thể xóa hóa đơn nháp.",
      });
    }
  };

  // Lọc tức thì trên client trong lúc chờ Debounce API
  const displayedOrders = useMemo(() => {
    if (!search.trim()) return orders;
    return filterAndRankBySearch(orders, search, (o) => [
      { text: o.orderCode || o.code, weight: 1.6 },
      { text: o.customerPhone, weight: 1.5 },
      { text: o.customerName, weight: 1.3 },
      { text: o.createdByName || o.soldByName, weight: 0.9 },
      ...(o.items || []).flatMap((i) => [
        { text: i.productCode, weight: 1.2 },
        { text: i.productName, weight: 1.1 },
      ]),
    ]);
  }, [orders, search]);

  const displayedReturns = useMemo(() => {
    if (!search.trim()) return returns;
    return filterAndRankBySearch(returns, search, (r) => [
      { text: r.code || r.returnCode, weight: 1.6 },
      { text: r.orderCode, weight: 1.5 },
      { text: r.customerPhone, weight: 1.5 },
      { text: r.customerName, weight: 1.3 },
      { text: r.performedByName, weight: 0.9 },
      { text: r.note, weight: 0.8 },
      ...(r.returnItems || []).flatMap((i) => [
        { text: i.productCode, weight: 1.2 },
        { text: i.productName, weight: 1.1 },
      ]),
      ...(r.exchangeItems || []).flatMap((i) => [
        { text: i.productCode, weight: 1.2 },
        { text: i.productName, weight: 1.1 },
      ]),
    ]);
  }, [returns, search]);


  return {
    orders,
    returns,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    paymentFilter,
    setPaymentFilter,
    debtFilter,
    setDebtFilter,
    returnTypeFilter,
    setReturnTypeFilter,
    actionMsg,
    loadData,
    displayedOrders,
    displayedReturns,
    ordPage,
    ordPageSize,
    ordTotal,
    ordTotalPages,
    setOrdPage,
    setOrdPageSize,
    retPage,
    retPageSize,
    retTotal,
    retTotalPages,
    setRetPage,
    setRetPageSize,
    handleConfirmDraft,
    handleDeleteDraft,
  };
}
