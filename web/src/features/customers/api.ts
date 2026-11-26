import { apiRequest } from "@/shared/api/client";
import type { Order, ReturnReceipt } from "@/shared/types";

export async function fetchRecentCustomersApi(): Promise<any[]> {
  const res = await apiRequest<any[]>("/customers");
  return Array.isArray(res.data) ? res.data : [];
}

export async function lookupCustomerByPhoneApi(qPhone: string): Promise<{
  customer: any;
  orders: Order[];
  returns: ReturnReceipt[];
}> {
  const res = await apiRequest<any>(
    `/customers/lookup?phone=${encodeURIComponent(qPhone)}`
  );
  return {
    customer: res.data?.customer || res.data,
    orders: Array.isArray(res.data?.orders) ? res.data.orders : [],
    returns: Array.isArray(res.data?.returns) ? res.data.returns : [],
  };
}
