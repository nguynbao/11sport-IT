import { useState, useEffect, useCallback, useMemo } from "react";
import type { ServiceOrder, ServiceOrdersMeta } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { useDebounce } from "@/shared/hooks/useDebounce";

export function useServiceOrders({
  onMetaChange,
}: {
  onMetaChange?: (meta: ServiceOrdersMeta) => void;
}) {
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
    fetchServiceOrders();
  }, [fetchServiceOrders]);

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
    serviceOrders,
    ordersMeta,
    loadingOrders,
    orderSearch,
    setOrderSearch,
    statusFilter,
    setStatusFilter,
    fetchServiceOrders,
    displayedOrders,
  };
}
