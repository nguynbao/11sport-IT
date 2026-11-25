import { apiRequest } from "@/shared/api/client";
import type {
  AttendanceConfig,
  AttendanceRecord,
  Department,
  Holiday,
  MyCalendarData,
  TimesheetData,
} from "@/shared/types";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export async function fetchHolidays(year?: number): Promise<Holiday[]> {
  const q = year ? `?year=${year}` : "";
  const res = await apiRequest<Holiday[]>(`/holidays${q}`);
  return res.data;
}

export async function syncVietnamHolidaysApi(year: number): Promise<{
  year: number;
  syncedCount: number;
  totalVietnamHolidays: number;
}> {
  const res = await apiRequest<{
    year: number;
    syncedCount: number;
    totalVietnamHolidays: number;
  }>(API_ENDPOINTS.HOLIDAYS.SYNC_VN, {
    method: "POST",
    body: JSON.stringify({ year }),
  });
  return res.data;
}

export async function createHolidayApi(data: {
  date: string;
  name: string;
  note?: string;
  isOfficialDayOff?: boolean;
}): Promise<Holiday> {
  const res = await apiRequest<Holiday>(API_ENDPOINTS.HOLIDAYS.BASE, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteHolidayApi(id: string): Promise<boolean> {
  const res = await apiRequest<{ success: boolean }>(API_ENDPOINTS.HOLIDAYS.byId(id), {
    method: "DELETE",
  });
  return res.data.success;
}


export async function fetchAttendanceHistory(params?: { staffId?: string; month?: string; year?: string }): Promise<AttendanceRecord[]> {
  const query = new URLSearchParams();
  if (params?.staffId) query.set("staffId", params.staffId);
  if (params?.month) query.set("month", params.month);
  if (params?.year) query.set("year", params.year);
  const qStr = query.toString();
  const res = await apiRequest<AttendanceRecord[]>(`/attendance/history${qStr ? `?${qStr}` : ""}`);
  return res.data;
}


export async function fetchAttendanceConfig(): Promise<{
  config: AttendanceConfig;
  detectedClientIp: string;
  isCurrentIpAllowed?: boolean;
}> {
  const res = await apiRequest<{
    config: AttendanceConfig;
    detectedClientIp: string;
    isCurrentIpAllowed?: boolean;
  }>(API_ENDPOINTS.ATTENDANCE.CONFIG);
  return res.data;
}

export async function updateAttendanceConfigApi(
  payload: Partial<AttendanceConfig> & {
    allowedIps?: string[] | string;
    allowedIps2?: string[] | string;
  }
): Promise<{ config: AttendanceConfig; detectedClientIp: string; isCurrentIpAllowed?: boolean; message?: string }> {
  const res = await apiRequest<{
    config: AttendanceConfig;
    detectedClientIp: string;
    isCurrentIpAllowed?: boolean;
    message?: string;
  }>(API_ENDPOINTS.ATTENDANCE.CONFIG, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.data;
}


export async function fetchTimesheetApi(params: {
  month: number;
  year: number;
  department?: Department | "ALL";
}): Promise<TimesheetData> {
  const q = new URLSearchParams({ month: String(params.month), year: String(params.year) });
  if (params.department && params.department !== "ALL") q.set("department", params.department);
  const res = await apiRequest<TimesheetData>(`${API_ENDPOINTS.ATTENDANCE.TIMESHEET}?${q.toString()}`);
  return res.data;
}

export async function adjustAttendanceApi(
  id: string,
  data: {
    checkIn?: string;
    checkOut?: string;
    shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF";
    checkInType?: "STANDARD" | "WFH";
    offType?: "OFF" | "PAID_LEAVE";
    overtimeStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
    overtimeApprovedMinutes?: number;
    reason: string;
  }
): Promise<AttendanceRecord> {
  const res = await apiRequest<AttendanceRecord>(API_ENDPOINTS.ATTENDANCE.byId(id), {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function createManualAttendanceApi(data: {
  staffId: string;
  date: string;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF";
  checkInType?: "STANDARD" | "WFH";
  offType?: "OFF" | "PAID_LEAVE";
  checkIn?: string;
  checkOut?: string;
  overtimeStatus?: "NONE" | "APPROVED";
  overtimeApprovedMinutes?: number;
  reason: string;
}): Promise<AttendanceRecord> {
  const res = await apiRequest<AttendanceRecord>(API_ENDPOINTS.ATTENDANCE.MANUAL, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}


export async function fetchMyCalendarApi(month: number, year: number): Promise<MyCalendarData> {
  const res = await apiRequest<MyCalendarData>(
    `${API_ENDPOINTS.ATTENDANCE.MY_CALENDAR}?month=${month}&year=${year}`
  );
  return res.data;
}

