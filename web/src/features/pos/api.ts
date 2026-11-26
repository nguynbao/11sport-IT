import { apiRequest } from "@/shared/api/client";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import type {
  CurrentShiftOrdersMeta,
  DailyHandoverCheckData,
  Order,
  ShiftHandoverCategoryCount,
  ShiftHandoverRecord,
} from "@/shared/types";

export async function fetchDailyHandoverCheckApi(date?: string): Promise<DailyHandoverCheckData> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  const res = await apiRequest<DailyHandoverCheckData>(
    `${API_ENDPOINTS.SHIFTS.HANDOVER_DAILY_CHECK}${query}`
  );
  return res.data;
}

export async function fetchHandoversApi(params?: {
  date?: string;
  from?: string;
  to?: string;
  status?: string;
  shiftCode?: string;
}): Promise<{
  items: ShiftHandoverRecord[];
  pendingIncomingHandover: ShiftHandoverRecord | null;
}> {
  const searchParams = new URLSearchParams();
  if (params?.date) searchParams.set("date", params.date);
  if (params?.from) searchParams.set("from", params.from);
  if (params?.to) searchParams.set("to", params.to);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.shiftCode) searchParams.set("shiftCode", params.shiftCode);
  const qs = searchParams.toString();
  const res = await apiRequest<any>(`${API_ENDPOINTS.SHIFTS.HANDOVER}${qs ? `?${qs}` : ""}`);
  const items: ShiftHandoverRecord[] = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.items)
    ? res.data.items
    : [];
  const pendingIncomingHandover: ShiftHandoverRecord | null =
    (res as any).meta?.pendingIncomingHandover ?? res.data?.pendingIncomingHandover ?? null;
  return { items, pendingIncomingHandover };
}

export async function createHandoverApi(data: {
  date?: string;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH";
  isDraft?: boolean;
  cashBalance: number;
  checkedCategories?: string[];
  totalCheckedProducts?: number;
  categoryCounts?: ShiftHandoverCategoryCount[];
  discrepancies?: Array<{
    productCode: string;
    productName?: string;
    categoryName?: string;
    expected: number;
    actual: number;
    note?: string;
  }>;
  notes?: string;
  lateCheckoutReason?: string;
  requireLateReason?: boolean;
}): Promise<{ handover: ShiftHandoverRecord; message: string }> {
  const res = await apiRequest<any>(API_ENDPOINTS.SHIFTS.HANDOVER, {
    method: "POST",
    body: JSON.stringify(data),
  });
  const handover = (res.data?.handover || res.data) as ShiftHandoverRecord;
  const message = String(
    (res as any).meta?.message || res.data?.message || "Đã gửi phiếu bàn giao ca!"
  );
  return { handover, message };
}

export async function confirmHandoverApi(
  id: string,
  accept: boolean,
  note?: string
): Promise<{ handover: ShiftHandoverRecord; message: string }> {
  const res = await apiRequest<any>(API_ENDPOINTS.SHIFTS.handoverConfirm(id), {
    method: "POST",
    body: JSON.stringify({ accept, note }),
  });
  const handover = (res.data?.handover || res.data) as ShiftHandoverRecord;
  const message = String(
    (res as any).meta?.message || res.data?.message || "Đã xác nhận thông tin bàn giao ca!"
  );
  return { handover, message };
}

export async function fetchCurrentShiftOrdersApi(params?: {
  search?: string;
  status?: string;
  paymentMethod?: string;
  date?: string;
  shiftCode?: string;
}): Promise<{ orders: Order[]; meta: CurrentShiftOrdersMeta }> {
  const q = new URLSearchParams();
  if (params?.search?.trim()) q.set("search", params.search.trim());
  if (params?.status && params.status !== "ALL") q.set("status", params.status);
  if (params?.paymentMethod && params.paymentMethod !== "ALL") {
    q.set("paymentMethod", params.paymentMethod);
  }
  if (params?.date?.trim()) {
    q.set("date", params.date.trim());
  }
  if (params?.shiftCode && params.shiftCode !== "ALL") {
    q.set("shiftCode", params.shiftCode);
  }
  const qs = q.toString();
  const res = await apiRequest<Order[]>(
    `${API_ENDPOINTS.ORDERS.CURRENT_SHIFT}${qs ? `?${qs}` : ""}`
  );
  return {
    orders: Array.isArray(res.data) ? res.data : [],
    meta: (res.meta as unknown as CurrentShiftOrdersMeta) || {
      total: 0,
      date: "",
      shiftCode: "BOTH",
      shiftLabel: "Cả ngày (Mọi ca)",
      summary: {
        paidOrdersCount: 0,
        draftOrdersCount: 0,
        totalRevenue: 0,
        cashTotal: 0,
        bankingTotal: 0,
        cardTotal: 0,
        debtTotal: 0,
      },
    },
  };
}
