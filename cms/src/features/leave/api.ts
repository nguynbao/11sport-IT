import { apiRequest } from "@/shared/api/client";
import type { LeaveRequest, LeaveRequestType, MyLeaveRequest } from "@/shared/types";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export async function fetchLeaveRequests(params?: { status?: string; type?: string; date?: string; staffId?: string }): Promise<LeaveRequest[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.type) query.set("type", params.type);
  if (params?.date) query.set("date", params.date);
  if (params?.staffId) query.set("staffId", params.staffId);
  const qStr = query.toString();
  const res = await apiRequest<LeaveRequest[]>(`/leave-requests${qStr ? `?${qStr}` : ""}`);
  return res.data;
}

export async function reviewLeaveRequestApi(id: string, status: "APPROVED" | "REJECTED", reviewNote?: string): Promise<LeaveRequest> {
  const res = await apiRequest<LeaveRequest>(API_ENDPOINTS.LEAVE_REQUESTS.byId(id), {
    method: "PATCH",
    body: JSON.stringify({ status, reviewNote }),
  });
  return res.data;
}


export async function createLeaveRequestApi(payload: {
  type: LeaveRequestType;
  date: string;
  fromDate?: string;
  sourceLeaveId?: string;
  sourceOffType?: "OFF" | "PAID_LEAVE";
  reason: string;
}): Promise<MyLeaveRequest> {
  const res = await apiRequest<MyLeaveRequest>(API_ENDPOINTS.LEAVE_REQUESTS.BASE, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchMyLeaveRequestsApi(): Promise<MyLeaveRequest[]> {
  const res = await apiRequest<MyLeaveRequest[]>("/leave-requests?mine=true");
  return res.data;
}

export async function cancelLeaveRequestApi(id: string): Promise<void> {
  await apiRequest(API_ENDPOINTS.LEAVE_REQUESTS.byId(id), { method: "DELETE" });
}


/* ---------------- v5.0: Mã sản phẩm CATE + BRAND + VERSION + MÀU + SIZE ---------------- */

