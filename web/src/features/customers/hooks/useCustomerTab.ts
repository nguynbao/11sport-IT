import { useEffect, useMemo, useRef, useState } from "react";
import type { Order, ReturnReceipt } from "@/shared/types";
import { cleanPhoneDigits, formatPhone } from "@/shared/utils/format";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useClientPagination } from "@/shared/hooks/useClientPagination";
import { filterAndRankBySearch } from "@/shared/lib/search";
import { fetchRecentCustomersApi, lookupCustomerByPhoneApi } from "../api";

export function useCustomerTab() {
  const [phone, setPhone] = useState("");
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnReceipt[]>([]);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const debouncedPhone = useDebounce(phone, 500);
  const userTypedRef = useRef(false);

  useEffect(() => {
    fetchRecentCustomersApi()
      .then(setAllCustomers)
      .catch(() => {});
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!debouncedPhone.trim()) return allCustomers.slice(0, 6);
    return filterAndRankBySearch(allCustomers, debouncedPhone, (c) => [
      { text: c.phone || c.customerPhone, weight: 1.5 },
      { text: c.fullName || c.name || c.customerName, weight: 1.3 },
    ]).slice(0, 8);
  }, [allCustomers, debouncedPhone]);

  const handleLookup = async (targetPhone?: string) => {
    const rawTarget = targetPhone ?? phone;
    const qPhone = cleanPhoneDigits(rawTarget);
    if (!qPhone) return;
    setPhone(formatPhone(qPhone));
    setLoading(true);
    setErrorMsg("");
    try {
      const { customer, orders: ordList, returns: retList } = await lookupCustomerByPhoneApi(qPhone);
      if (!customer || (!customer.phone && !customer.customerPhone && ordList.length === 0)) {
        setCustomerInfo(null);
        setOrders([]);
        setReturns([]);
        setErrorMsg(`Không tìm thấy hồ sơ khách hàng hoặc đơn hàng với SĐT "${formatPhone(qPhone)}".`);
      } else {
        setCustomerInfo(customer);
        setOrders(ordList);
        setReturns(retList);
      }
    } catch (err: any) {
      setCustomerInfo(null);
      setOrders([]);
      setReturns([]);
      setErrorMsg(err?.message || "Không tìm thấy thông tin khách hàng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userTypedRef.current) return;
    const digits = cleanPhoneDigits(debouncedPhone);
    if (digits.length >= 9 && /^[\d\s+().-]+$/.test(debouncedPhone.trim())) {
      handleLookup(digits);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPhone]);

  const handlePhoneInputChange = (val: string) => {
    userTypedRef.current = true;
    if (/^[\d\s+().-]*$/.test(val)) {
      setPhone(formatPhone(val));
    } else {
      setPhone(val);
    }
  };

  const handleSelectSuggestion = (cPhone: string) => {
    userTypedRef.current = false;
    handleLookup(cPhone);
  };

  const ordersPagination = useClientPagination(orders, 10);

  return {
    phone,
    customerInfo,
    orders,
    returns,
    filteredCustomers,
    loading,
    errorMsg,
    handleLookup,
    handlePhoneInputChange,
    handleSelectSuggestion,
    ordersPagination,
  };
}
