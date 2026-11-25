import type { ContractType, Department, StaffUser, UserRole } from "./staff";

export interface Holiday {
  _id: string;
  date: string;
  name: string;
  note?: string;
  isSystemVn?: boolean;
  isOfficialDayOff?: boolean;
  lunarDate?: string;
}

export interface LeaveRequest {
  _id: string;
  staffId: string;
  staffCode: string;
  staffName: string;
  department: Department;
  type: "WFH" | "OFF" | "LATE" | "EARLY" | "PAID_LEAVE" | "CHANGE_OFF";
  date: string;
  fromDate?: string;
  sourceLeaveId?: string;
  sourceOffType?: "OFF" | "PAID_LEAVE";
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt?: string;
}

export interface ShiftAssignment {
  _id: string;
  weekStart: string;
  date: string;
  dayOfWeek: number;
  staffId: string;
  staffCode: string;
  staffName: string;
  shiftCode: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF";
  preferenceShift?: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF";
  isOffRequested?: boolean;
  assignedBy: "AUTO" | "HR";
  confirmedAt?: string | null;
  seenByStaff?: boolean;
  notes?: string;
}

export interface AttendanceRecord {
  _id: string;
  staffId: string;
  staffCode: string;
  staffName: string;
  department: Department;
  date: string;
  shiftCode: "SHIFT_1" | "SHIFT_2" | "BOTH";
  checkInTime: string;
  workStartTime: string;
  checkOutTime?: string;
  checkInType: "STANDARD" | "WFH";
  status: "ON_TIME" | "LATE" | "EARLY_LEAVE" | "COMPLETED";
  lateMinutes: number;
  earlyMinutes: number;
  lateCheckoutMinutes?: number;
  lateCheckoutReason?: string;
  overtimeStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  overtimeApprovedMinutes?: number;
  lunchPauseMinutes: number;
  totalWorkHours: number;
  notes?: string;
}


export interface StaffMonthlyOffStats {
  limit: number;
  primaryMonth: string;
  usedTotal: number;
  usedOutsideWeek: number;
  remainingForWeek: number;
  byMonth?: Record<
    string,
    {
      limit: number;
      usedTotal: number;
      usedOutsideWeek: number;
      remainingForWeek: number;
    }
  >;
}

export interface StaffPaidLeaveStats {
  eligible: boolean;
  entitledInMonth: number;
  remainingAfterMonth: number;
  paidLeaveDatesInWeek: string[];
  formalLeaveDatesInWeek: string[];
}

export interface StaffOffRequestItem {
  date: string;
  type: string;
  status: string;
  reason: string;
}


export interface AttendanceConfig {
  _id?: string;
  key?: string;
  officeName: string;
  office2Name?: string;
  officeLat?: number;
  officeLng?: number;
  maxDistanceMeters?: number;
  allowedIps: string[];
  allowedIps2?: string[];
  office1Domain?: string;
  office2Domain?: string;
  requireGps?: boolean;
  requireIp: boolean;
  branches?: Array<{
    id: number;
    name: string;
    allowedIps: string[];
    domain?: string;
  }>;
  updatedBy?: string;
  updatedAt?: string;
}


export type TimesheetCellCode =
  | "ON_TIME"
  | "LATE"
  | "EARLY"
  | "LATE_EARLY"
  | "WFH"
  | "WORKING"
  | "MISSING_OUT"
  | "LEAVE"
  | "PAID_LEAVE"
  | "ABSENT"
  | "HOLIDAY"
  | "DAY_OFF"
  | "UNSCHEDULED"
  | "FUTURE";

export interface TimesheetCell {
  code: TimesheetCellCode;
  attendanceId?: string;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH" | null;
  checkIn?: string | null;
  checkOut?: string | null;
  hours?: number;
  lateMinutes?: number;
  earlyMinutes?: number;
  lateCheckoutMinutes?: number;
  lateCheckoutReason?: string;
  overtimeStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  overtimeApprovedMinutes?: number;
  overtimeMinutes?: number;
  checkInType?: "STANDARD" | "WFH";
  isHolidayWork?: boolean;
  /** Ngày lễ chính thức được nghỉ hưởng nguyên lương (tính 1 công) */
  isPaidHoliday?: boolean;
  adjusted?: boolean;
  adjustedByName?: string;
  adjustReason?: string;
  note?: string;
  leaveRequests?: {
    id: string;
    type: string;
    status: string;
    reason?: string;
    reviewNote?: string;
  }[];
}

export interface TimesheetSummary {
  standardDays: number;
  workUnits: number;
  totalHours: number;
  lateCount: number;
  lateMinutes: number;
  earlyCount: number;
  earlyMinutes: number;
  missingCheckout: number;
  absentDays: number;
  leaveDays: number;
  wfhDays: number;
  holidayWorkDays: number;
  /** Giờ đi làm vào ngày lễ chính thức (trả lương làm thêm >= 300%) */
  holidayWorkHours: number;
  /** Số ngày lễ chính thức được nghỉ hưởng nguyên lương (tính công) */
  holidayPaidDays: number;
  /** Tổng công tính lương = công đi làm + công lễ hưởng lương + phép có lương */
  paidUnits: number;
  overtimeDays?: number;
  overtimeMinutes?: number;
  pendingRequests?: number;
  /** Quỹ ngày nghỉ phép có lương tích lũy đến tháng đang xem */
  paidLeaveEntitled?: number;
  paidLeaveFromProbation?: number;
  paidLeaveTotalEarned?: number;
  paidLeaveUsedTotal?: number;
  paidLeaveUsed?: number;
  paidLeaveRemaining?: number;
  paidLeaveForfeited?: number;
  /** Khối SALES: tối đa 4 ngày nghỉ không lương/tháng */
  salesOffEntitled?: number;
  salesOffUsed?: number;
  salesOffRemaining?: number;
}

export interface TimesheetRow {
  staffId: string;
  staffCode: string;
  staffName: string;
  department: Department;
  role: UserRole;
  contractType?: ContractType;
  standardHours: number;
  cells: Record<string, TimesheetCell>;
  summary: TimesheetSummary;
}

export interface TimesheetDay {
  date: string;
  day: number;
  weekday: number;
  isToday: boolean;
  holiday: { name: string; isOfficialDayOff: boolean } | null;
}

export interface TimesheetMonthMeta {
  daysInMonth: number;
  isLeapYear: boolean;
  sundaysCount: number;
  standardDays: number;
  officialHolidaysCount: number;
  officePaidHolidaysCount: number;
}

export interface TimesheetData {
  month: number;
  year: number;
  days: TimesheetDay[];
  rows: TimesheetRow[];
  monthMeta?: TimesheetMonthMeta;
  overview: {
    totalStaff: number;
    workingNow: number;
    checkedInToday: number;
    lateToday: number;
    notCheckedInToday: number;
    missingCheckoutMonth: number;
    absentMonth: number;
  };
}


export interface ShiftChange {
  staffId: string;
  date: string;
  dayOfWeek?: number;
  /** null = xoá phân ca của nhân viên ngày đó */
  shiftCode: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF" | null;
}

export interface ShiftOffOverride {
  staffId: string;
  staffName: string;
  date: string;
  shiftCode: string;
  leaveType: string;
  leaveStatus: string;
}


export interface ShiftHandoverDiscrepancy {
  productCode: string;
  productName?: string;
  categoryName?: string;
  expected: number;
  actual: number;
  note?: string;
}

export interface ShiftHandoverCategoryCount {
  categoryId?: string;
  categoryName: string;
  expectedTotalQty: number;
  actualTotalQty: number;
  note?: string;
}

export interface ShiftHandoverRecord {
  _id: string;
  date: string;
  shiftCode: "SHIFT_1" | "SHIFT_2" | "BOTH";
  fromStaffId: string;
  fromStaffName: string;
  toStaffId?: string;
  toStaffName?: string;
  cashBalance: number;
  checkedCategories?: string[];
  totalCheckedProducts?: number;
  categoryCounts?: ShiftHandoverCategoryCount[];
  discrepancies: ShiftHandoverDiscrepancy[];
  status: "DRAFT" | "PENDING" | "ACCEPTED" | "DISCREPANCY_REPORTED" | "STORE_CLOSED";
  notes?: string;
  confirmNote?: string;
  submittedAt?: string;
  lateCheckoutReason?: string;
  lateCheckoutMinutes?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyHandoverCategorySummary {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  isPrimaryCategory: boolean;
  productCount: number;
  expectedTotalQty: number;
  unit: string;
}

export interface DailyHandoverCheckData {
  date: string;
  weekday?: number;
  primaryCategory: { _id: string; name: string; slug: string } | null;
  companionCategory: { _id: string; name: string; slug: string } | null;
  checkedCategories: string[];
  checkedCategoryLabel: string;
  totalCheckedProducts: number;
  totalExpectedQty?: number;
  categorySummaries?: DailyHandoverCategorySummary[];
  weeklySchedule?: Record<string, string[]>;
  products: Array<{
    _id: string;
    code: string;
    name: string;
    unit: string;
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    isPrimaryCategory: boolean;
    stockQtyFloor1: number;
  }>;
}

export interface HandoverScheduleConfigData {
  weeklySchedule: Record<string, string[]>;
  primaryCategory: any;
  availableCategories: Array<{
    _id: string;
    code?: string;
    name: string;
    slug?: string;
    productCount?: number;
    expectedTotalQty?: number;
    isPrimary?: boolean;
  }>;
}


export type MyCalendarCellCode = TimesheetCellCode;
export type LeaveRequestType = "WFH" | "OFF" | "LATE" | "EARLY" | "PAID_LEAVE" | "CHANGE_OFF";
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface MyCalendarLeave {
  id: string;
  type: LeaveRequestType;
  status: LeaveRequestStatus;
  reason?: string;
  reviewNote?: string;
}

export interface MyCalendarCell {
  code: MyCalendarCellCode;
  attendanceId?: string;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH" | null;
  checkIn?: string | null;
  checkOut?: string | null;
  hours?: number;
  lateMinutes?: number;
  earlyMinutes?: number;
  lateCheckoutMinutes?: number;
  lateCheckoutReason?: string;
  overtimeStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  overtimeApprovedMinutes?: number;
  overtimeMinutes?: number;
  isHolidayWork?: boolean;
  isPaidHoliday?: boolean;
  adjusted?: boolean;
  adjustReason?: string;
  earlyApproved?: boolean;
  lateApproved?: boolean;
  leaveRequests?: MyCalendarLeave[];
  note?: string;
}

export type MyCalendarSummary = TimesheetSummary;
export type MyCalendarDay = TimesheetDay;

export interface MyCalendarData {
  month: number;
  year: number;
  days: MyCalendarDay[];
  row: {
    staffId: string;
    staffCode: string;
    staffName: string;
    department: "OFFICE" | "SALES";
    role: UserRole;
    contractType?: ContractType;
    standardHours: number;
    cells: Record<string, MyCalendarCell>;
    summary: MyCalendarSummary;
  } | null;
  rules: {
    shifts: Record<string, string>;
    lateToleranceMinutes: number;
    overtimeMinMinutes: number;
    holidayWorkPayMultiplier?: number;
  };
}

export interface MyLeaveRequest {
  _id: string;
  staffId: string;
  staffCode?: string;
  staffName?: string;
  department?: string;
  type: LeaveRequestType;
  date: string;
  fromDate?: string;
  sourceLeaveId?: string;
  sourceOffType?: "OFF" | "PAID_LEAVE";
  reason: string;
  status: LeaveRequestStatus;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt?: string;
}


