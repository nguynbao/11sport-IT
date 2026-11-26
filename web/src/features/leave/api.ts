import { apiRequest } from "@/shared/api/client";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import type { LeaveRequestType, MyLeaveRequest } from "@/shared/types";

export async function createLeaveRequestApi(data: {
  type: LeaveRequestType;
  date: string;
  fromDate?: string;
  sourceLeaveId?: string;
  reason: string;
}): Promise<any> {
  const res = await apiRequest(API_ENDPOINTS.LEAVE_REQUESTS.BASE, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function fetchMyLeaveRequestsApi(): Promise<MyLeaveRequest[]> {
  const res = await apiRequest<MyLeaveRequest[]>(API_ENDPOINTS.LEAVE_REQUESTS.MINE);
  return res.data;
}

export async function cancelLeaveRequestApi(id: string): Promise<boolean> {
  const res = await apiRequest<{ success: boolean }>(API_ENDPOINTS.LEAVE_REQUESTS.byId(id), {
    method: "DELETE",
  });
  return res.data.success;
}
