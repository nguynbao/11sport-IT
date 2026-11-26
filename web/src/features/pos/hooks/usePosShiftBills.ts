import { useState, useEffect, useCallback, useRef } from "react";
import type { CurrentShiftOrdersMeta, Order } from "@/shared/types";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useClientPagination } from "@/shared/hooks/useClientPagination";
import { fetchCurrentShiftOrdersApi } from "../api";
import { getLocalDateStr, getRecentQuickDates } from "../utils/shiftBills";

interface UsePosShiftBillsParams {
  onMetaChange?: (meta: CurrentShiftOrdersMeta) => void;
  refreshTrigger?: number;
}

export function usePosShiftBills({ onMetaChange, refreshTrigger = 0 }: UsePosShiftBillsParams) {
  const [orders, setOrders] = useState<Order[]>([]);
  const {
    page,
    pageSize,
    total: totalBills,
    totalPages,
    items: pagedOrders,
    setPage,
    setPageSize,
  } = useClientPagination(orders, 20);
  const [meta, setMeta] = useState<CurrentShiftOrdersMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<string>(() => getLocalDateStr());
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const currentDayRef = useRef<string>(getLocalDateStr());
  const quickDates = getRecentQuickDates(3);
  const maxDate = meta?.maxDate || getLocalDateStr();

  const loadShiftBills = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetchCurrentShiftOrdersApi({
        search: debouncedSearch,
        status: statusFilter,
        paymentMethod: paymentFilter,
        date: dateFilter,
        shiftCode: shiftFilter,
      });
      setOrders(res.orders);
      setMeta(res.meta);
      if (onMetaChange) {
        onMetaChange(res.meta);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tải danh sách bill trong ngày");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, paymentFilter, dateFilter, shiftFilter, onMetaChange]);

  useEffect(() => {
    loadShiftBills();
  }, [loadShiftBills, refreshTrigger]);

  // Tự động kiểm tra khi qua 00:00 sang ngày mới -> cập nhật lại mốc ngày hiện tại
  useEffect(() => {
    const timer = setInterval(() => {
      const today = getLocalDateStr();
      if (today !== currentDayRef.current) {
        const prevToday = currentDayRef.current;
        currentDayRef.current = today;
        setDetailOrder(null);
        if (dateFilter === prevToday) {
          setDateFilter(today);
        } else {
          loadShiftBills();
        }
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [loadShiftBills, dateFilter]);

  const summary = meta?.summary || {
    paidOrdersCount: 0,
    draftOrdersCount: 0,
    totalRevenue: 0,
    cashTotal: 0,
    bankingTotal: 0,
    cardTotal: 0,
    debtTotal: 0,
  };

  return {
    orders,
    page,
    pageSize,
    totalBills,
    totalPages,
    pagedOrders,
    setPage,
    setPageSize,
    meta,
    loading,
    errorMsg,
    search,
    setSearch,
    dateFilter,
    setDateFilter,
    shiftFilter,
    setShiftFilter,
    statusFilter,
    setStatusFilter,
    paymentFilter,
    setPaymentFilter,
    detailOrder,
    setDetailOrder,
    quickDates,
    maxDate,
    loadShiftBills,
    summary,
  };
}
