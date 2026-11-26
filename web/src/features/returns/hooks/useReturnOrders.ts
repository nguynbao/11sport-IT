import { useState, useEffect, useMemo, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Order, Product, ReturnReceipt } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { filterAndRankBySearch } from "@/shared/lib/search";
import type { ExchangeItemForm, ReturnItemForm } from "../types";

interface Params {
  setExchangeRows: Dispatch<SetStateAction<ExchangeItemForm[]>>;
  setExchangeSearch: Dispatch<SetStateAction<string>>;
  applySellableList: (rawList: Product[]) => void;
}

export function useReturnOrders({ setExchangeRows, setExchangeSearch, applySellableList }: Params) {
  const [orderCodeInput, setOrderCodeInput] = useState("");
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [recentReturns, setRecentReturns] = useState<ReturnReceipt[]>([]);
  const [returnRows, setReturnRows] = useState<ReturnItemForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadInitialLists = useCallback(async () => {
    const [ordSettled, prodSettled, retSettled] = await Promise.allSettled([
      apiRequest<Order[]>("/orders"),
      apiRequest<Product[]>("/products?onlySellable=true"),
      apiRequest<ReturnReceipt[]>("/returns"),
    ]);

    if (ordSettled.status === "fulfilled" && Array.isArray(ordSettled.value.data)) {
      setRecentOrders(ordSettled.value.data);
    }
    if (prodSettled.status === "fulfilled" && Array.isArray(prodSettled.value.data)) {
      applySellableList(prodSettled.value.data);
    }
    if (retSettled.status === "fulfilled" && Array.isArray(retSettled.value.data)) {
      setRecentReturns(retSettled.value.data);
    }
  }, [applySellableList]);

  useEffect(() => {
    loadInitialLists();
  }, [loadInitialLists]);

  const debouncedOrderQuery = useDebounce(orderCodeInput, 350);

  const matchingRecentOrders = useMemo(() => {
    if (!debouncedOrderQuery.trim()) return recentOrders.slice(0, 6);
    return filterAndRankBySearch(recentOrders, debouncedOrderQuery, (o) => [
      { text: o.orderCode || o.code, weight: 1.6 },
      { text: o.customerPhone, weight: 1.5 },
      { text: o.customerName, weight: 1.3 },
      ...(o.items || []).flatMap((it) => [
        { text: it.productCode, weight: 1.1 },
        { text: it.productName, weight: 1.0 },
      ]),
    ]).slice(0, 8);
  }, [recentOrders, debouncedOrderQuery]);

  const prepareOrderForReturn = useCallback((ord: Order, preserveMessages = false) => {
    setSelectedOrder(ord);
    setOrderCodeInput(ord.orderCode || ord.code || "");
    if (!preserveMessages) {
      setErrorMsg("");
      setSuccessMsg("");
    }

    const rows: ReturnItemForm[] = (ord.items || []).map((it, idx) => {
      const alreadyReturned = Number(it.returnedQuantity || 0);
      const maxReturnable = Math.max(0, Number(it.quantity) - alreadyReturned);
      return {
        lineIndex: idx,
        productId: it.productId,
        productCode: it.productCode,
        productName: it.productName,
        color: String(it.color || "").trim(),
        size: String(it.size || "").trim(),
        isGift: Boolean(it.isGift) || it.discountType === "GIFT",
        originalUnitPrice: Number((it as any).originalUnitPrice || it.unitPrice || 0),
        unitPrice: Number(it.unitPrice),
        maxReturnable,
        quantity: 0,
        condition: "GOOD",
      };
    });
    setReturnRows(rows);
    setExchangeRows([]);
    setExchangeSearch("");
  }, []);

  const handleSearchOrder = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = orderCodeInput.trim();
    if (!code) return;

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      try {
        const res = await apiRequest<Order>(`/orders/by-code/${encodeURIComponent(code)}`);
        if (res.data) {
          prepareOrderForReturn(res.data);
          return;
        }
      } catch {
        // Fallback tìm trong danh sách đơn hàng
      }

      const listRes = await apiRequest<Order[]>(
        `/orders?search=${encodeURIComponent(code)}&forReturn=true`
      );
      const list = Array.isArray(listRes.data) ? listRes.data : [];
      const found =
        list.find(
          (o) =>
            (o.orderCode || o.code || "").toUpperCase() === code.toUpperCase() || o._id === code
        ) || list[0];
      if (!found) {
        setSelectedOrder(null);
        setErrorMsg(`Không tìm thấy đơn hàng với mã hoặc từ khóa "${code}".`);
      } else {
        prepareOrderForReturn(found);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi tra cứu đơn hàng gốc.");
    } finally {
      setLoading(false);
    }
  };

  return {
    orderCodeInput,
    setOrderCodeInput,
    selectedOrder,
    recentReturns,
    returnRows,
    setReturnRows,
    loading,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    matchingRecentOrders,
    prepareOrderForReturn,
    handleSearchOrder,
    loadInitialLists,
  };
}
