import { apiRequest } from "@/shared/api/client";
import type {
  DailyHandoverCheckData,
  HandoverScheduleConfigData,
  ShiftAssignment,
  ShiftChange,
  ShiftHandoverRecord,
  ShiftOffOverride,
  StaffMonthlyOffStats,
  StaffOffRequestItem,
  StaffPaidLeaveStats,
  StaffUser,
} from "@/shared/types";

export async function fetchShiftSchedule(weekStart?: string): Promise<{
  assignments: ShiftAssignment[];
  staffList: StaffUser[];
  monthlyOffByStaff?: Record<string, StaffMonthlyOffStats>;
  paidLeaveByStaff?: Record<string, StaffPaidLeaveStats>;
  offRequestsByStaff?: Record<string, StaffOffRequestItem[]>;
}> {
  const query = weekStart ? `?weekStart=${weekStart}` : "";
  const res = await apiRequest<{
    assignments: ShiftAssignment[];
    staffList: StaffUser[];
    monthlyOffByStaff?: Record<string, StaffMonthlyOffStats>;
    paidLeaveByStaff?: Record<string, StaffPaidLeaveStats>;
    offRequestsByStaff?: Record<string, StaffOffRequestItem[]>;
  }>(`/shifts/schedule${query}`);
  return res.data;
}

export async function assignShiftApi(data: { staffId: string; date: string; weekStart?: string; dayOfWeek?: number; shiftCode: "SHIFT_1" | "SHIFT_2" | "OFF" }): Promise<ShiftAssignment> {
  const res = await apiRequest<ShiftAssignment>("/shifts/assign", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.data;
}


export async function saveShiftChangesApi(
  weekStart: string,
  changes: ShiftChange[],
  confirmWeek?: boolean
): Promise<{ created: number; updated: number; deleted: number; confirmed?: number; offOverrides?: ShiftOffOverride[] }> {
  const res = await apiRequest<{ created: number; updated: number; deleted: number; confirmed?: number; offOverrides?: ShiftOffOverride[] }>("/shifts/assign/bulk", {
    method: "PUT",
    body: JSON.stringify({ weekStart, changes, confirmWeek }),
  });
  return res.data;
}


export async function fetchHandoverScheduleConfigApi(): Promise<HandoverScheduleConfigData> {
  const res = await apiRequest<any>("/shifts/handover/schedule-config");
  const raw = res.data || {};
  const list = Array.isArray(raw.availableCategories)
    ? raw.availableCategories
    : Array.isArray(raw.availableCompanionCategories)
    ? raw.availableCompanionCategories
    : [];
  return {
    weeklySchedule: raw.weeklySchedule || {},
    primaryCategory: raw.primaryCategory || null,
    availableCategories: list,
  };
}

export async function updateHandoverScheduleConfigApi(
  weeklySchedule: Record<string, string[]>
): Promise<{ weeklySchedule: Record<string, string[]>; message?: string }> {
  const res = await apiRequest<any>("/shifts/handover/schedule-config", {
    method: "PUT",
    body: JSON.stringify({ weeklySchedule }),
  });
  return {
    weeklySchedule: res.data?.weeklySchedule || weeklySchedule,
    message: (res as any).meta?.message || res.data?.message,
  };
}

export async function fetchShiftHandoversApi(params?: {
  date?: string;
  from?: string;
  to?: string;
  status?: string;
  shiftCode?: string;
  staffId?: string;
  hasDiscrepancy?: boolean;
}): Promise<{
  items: ShiftHandoverRecord[];
  pendingIncomingHandover: ShiftHandoverRecord | null;
}> {
  const q = new URLSearchParams();
  if (params?.date) q.set("date", params.date);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.status && params.status !== "ALL") q.set("status", params.status);
  if (params?.shiftCode && params.shiftCode !== "ALL") q.set("shiftCode", params.shiftCode);
  if (params?.staffId) q.set("staffId", params.staffId);
  if (params?.hasDiscrepancy) q.set("onlyDiscrepancy", "true");
  const qs = q.toString();
  const res = await apiRequest<any>(`/shifts/handover${qs ? `?${qs}` : ""}`);
  const items: ShiftHandoverRecord[] = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.items)
    ? res.data.items
    : [];
  const pendingIncomingHandover: ShiftHandoverRecord | null =
    (res as any).meta?.pendingIncomingHandover ?? res.data?.pendingIncomingHandover ?? null;
  return { items, pendingIncomingHandover };
}

export async function fetchDailyHandoverCheckApi(date?: string): Promise<DailyHandoverCheckData> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  const res = await apiRequest<DailyHandoverCheckData>(`/shifts/handover/daily-check${qs}`);
  return res.data;
}

export async function confirmShiftHandoverApi(
  id: string,
  accept: boolean,
  note?: string
): Promise<{ handover: ShiftHandoverRecord; message: string }> {
  const res = await apiRequest<any>(`/shifts/handover/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify({ accept, note }),
  });
  const handover = (res.data?.handover || res.data) as ShiftHandoverRecord;
  const message = String(
    (res as any).meta?.message || res.data?.message || "Đã cập nhật trạng thái phiếu bàn giao ca!"
  );
  return { handover, message };
}

export async function deleteShiftHandoverApi(id: string): Promise<{ deleted: boolean; id: string }> {
  const res = await apiRequest<{ deleted: boolean; id: string }>(`/shifts/handover/${id}`, {
    method: "DELETE",
  });
  return res.data;
}

