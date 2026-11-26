import { apiRequest } from "@/shared/api/client";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import type {
  AttendanceData,
  MyCalendarData,
  MyShiftScheduleData,
  ShiftHandoverRecord,
} from "@/shared/types";

export async function checkInApi(params?: {
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH";
}): Promise<{ attendance: AttendanceData; isWfh: boolean; message: string }> {
  const res = await apiRequest<{ attendance: AttendanceData; isWfh: boolean; message: string }>(
    API_ENDPOINTS.ATTENDANCE.CHECK_IN,
    {
      method: "POST",
      body: JSON.stringify(params || {}),
    }
  );
  return res.data;
}

export async function checkOutApi(params?: {
  forceEarly?: boolean;
  earlyReason?: string;
  lateCheckoutReason?: string;
  requireConfirmation?: boolean;
}): Promise<{ attendance: AttendanceData; awaitingHandoverConfirm?: boolean; message: string }> {
  const res = await apiRequest<{
    attendance: AttendanceData;
    awaitingHandoverConfirm?: boolean;
    message: string;
  }>(API_ENDPOINTS.ATTENDANCE.CHECK_OUT, {
    method: "POST",
    body: JSON.stringify(params || {}),
  });
  return res.data;
}

export async function getTodayAttendanceApi(): Promise<{
  date: string;
  attendance: AttendanceData | null;
  assignedShift?: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF" | null;
  isWfhToday: boolean;
  isEarlyApprovedToday?: boolean;
  handoverStatus: "DRAFT" | "PENDING" | "ACCEPTED" | "DISCREPANCY_REPORTED" | "STORE_CLOSED" | null;
  currentShiftHandover?: ShiftHandoverRecord | null;
  pendingIncomingHandover?: ShiftHandoverRecord | null;
}> {
  const res = await apiRequest<{
    date: string;
    attendance: AttendanceData | null;
    assignedShift?: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF" | null;
    isWfhToday: boolean;
    isEarlyApprovedToday?: boolean;
    handoverStatus: "DRAFT" | "PENDING" | "ACCEPTED" | "DISCREPANCY_REPORTED" | "STORE_CLOSED" | null;
    currentShiftHandover?: ShiftHandoverRecord | null;
    pendingIncomingHandover?: ShiftHandoverRecord | null;
  }>(API_ENDPOINTS.ATTENDANCE.TODAY);
  return res.data;
}

export async function fetchMyCalendarApi(month: number, year: number): Promise<MyCalendarData> {
  const res = await apiRequest<MyCalendarData>(
    `${API_ENDPOINTS.ATTENDANCE.MY_CALENDAR}?month=${month}&year=${year}`
  );
  return res.data;
}

export async function submitShiftPreferencesApi(data: {
  weekStart: string;
  preferences: Array<{
    date: string;
    dayOfWeek: number;
    isOffRequested: boolean;
    preferenceShift: string;
    leaveType?: "OFF" | "PAID_LEAVE";
  }>;
}): Promise<any> {
  const res = await apiRequest(API_ENDPOINTS.SHIFTS.PREFERENCES, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function fetchMyShiftScheduleApi(weekStart?: string): Promise<MyShiftScheduleData> {
  const q = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
  const res = await apiRequest<MyShiftScheduleData>(`${API_ENDPOINTS.SHIFTS.MY_SCHEDULE}${q}`);
  return res.data;
}

export async function markMyShiftScheduleSeenApi(weekStart?: string): Promise<{ markedCount: number }> {
  const res = await apiRequest<{ markedCount: number }>(API_ENDPOINTS.SHIFTS.MY_SCHEDULE_SEEN, {
    method: "POST",
    body: JSON.stringify(weekStart ? { weekStart } : {}),
  });
  return res.data;
}
