import type { ContractType, Department } from "./staff";

export interface AttendanceData {
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
  pendingCheckOutTime?: string;
  checkInType: "STANDARD" | "WFH";
  status: "ON_TIME" | "LATE" | "EARLY_LEAVE" | "COMPLETED";
  lateMinutes: number;
  earlyMinutes: number;
  lateCheckoutMinutes?: number;
  lateCheckoutReason?: string;
  overtimeStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  overtimeApprovedMinutes?: number;
  totalWorkHours: number;
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
  categoryCode: string;
  categoryName: string;
  expectedTotalQty: number;
  actualTotalQty: number;
  unit?: string;
  productCount?: number;
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
  submittedAt?: string;
  acceptedAt?: string;
  notes?: string;
  confirmNote?: string;
  lateCheckoutReason?: string;
  lateCheckoutMinutes?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyHandoverCategoryInfo {
  _id: string;
  code?: string;
  name: string;
  slug: string;
  unit?: string;
  productCount?: number;
  expectedTotalQty?: number;
}

export interface DailyHandoverCategorySummary {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  isPrimaryCategory: boolean;
  unit: string;
  productCount: number;
  expectedTotalQty: number;
}

export interface DailyHandoverProductItem {
  _id: string;
  code: string;
  name: string;
  unit: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  isPrimaryCategory: boolean;
  stockQtyFloor1: number;
  variants: Array<{
    sku: string;
    size?: string;
    color?: string;
    stockQtyFloor1: number;
  }>;
}

export interface DailyHandoverCheckData {
  date: string;
  weekday?: number;
  primaryCategory: DailyHandoverCategoryInfo | null;
  companionCategory: DailyHandoverCategoryInfo | null;
  checkedCategories: string[];
  checkedCategoryLabel: string;
  totalCheckedProducts: number;
  totalExpectedQty?: number;
  categorySummaries?: DailyHandoverCategorySummary[];
  weeklySchedule?: Record<string, string[]>;
  products: DailyHandoverProductItem[];
}

export interface MyShiftAssignmentItem {
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
}

export interface MyShiftScheduleData {
  weekStart: string;
  weekEnd?: string;
  nextMonday?: string;
  currentMonday?: string;
  nextWeekStart: string;
  currentWeekStart: string;
  assignments: MyShiftAssignmentItem[];
  currentWeekAssignments: MyShiftAssignmentItem[];
  isRegistered: boolean;
  isConfirmedByHr: boolean;
  unseenConfirmedCount: number;
  hasUnseenConfirmedSchedule: boolean;
  offOverrideNotices?: {
    date: string;
    shiftCode: string;
    leaveType: string;
    leaveStatus: string;
  }[];
  weeklyOffRules?: {
    maxOffPerWeek: number;
    maxUnpaidOffPerWeek: number;
    maxPaidLeavePerWeek: number;
    advanceNoticeDays: number;
  };
  paidLeaveQuota?: {
    eligible: boolean;
    contractType: string;
    probationLeaveDays: number;
    fulltimeMonths: number;
    totalEarnedUpToMonth: number;
    usedBeforeMonth: number;
    usedInMonth: number;
    entitledInMonth: number;
    remainingAfterMonth: number;
    paidLeaveDatesInWeek: string[];
    formalLeaveDatesInWeek: string[];
  };
  monthlyOffQuota?: {
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
        usedDatesOutsideWeek: string[];
      }
    >;
  };
}

export type MyCalendarCellCode =
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

export type LeaveRequestType = "WFH" | "OFF" | "LATE" | "EARLY" | "PAID_LEAVE" | "CHANGE_OFF";
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface MyCalendarLeave {
  id: string;
  type: LeaveRequestType;
  status: LeaveRequestStatus;
  date?: string;
  fromDate?: string;
  sourceOffType?: "OFF" | "PAID_LEAVE";
  reason: string;
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
  checkInType?: "STANDARD" | "WFH";
  isHolidayWork?: boolean;
  isPaidHoliday?: boolean;
  overtimeMinutes?: number;
  earlyApproved?: boolean;
  lateApproved?: boolean;
  leaveRequests?: MyCalendarLeave[];
  adjusted?: boolean;
  adjustedByName?: string;
  adjustReason?: string;
  note?: string;
}

export interface MyCalendarSummary {
  standardDays: number;
  workUnits: number;
  paidUnits: number;
  holidayPaidDays: number;
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
  holidayWorkHours: number;
  overtimeDays: number;
  overtimeMinutes: number;
  pendingRequests: number;
  paidLeaveEntitled: number;
  paidLeaveFromProbation?: number;
  paidLeaveTotalEarned?: number;
  paidLeaveUsedTotal?: number;
  paidLeaveUsed: number;
  paidLeaveRemaining?: number;
  paidLeaveForfeited: number;
  salesOffEntitled?: number;
  salesOffUsed?: number;
  salesOffRemaining?: number;
}

export interface MyCalendarDay {
  date: string;
  day: number;
  weekday: number;
  isToday: boolean;
  holiday: { name: string; isOfficialDayOff: boolean } | null;
}

export interface MyCalendarData {
  month: number;
  year: number;
  days: MyCalendarDay[];
  row: {
    staffId: string;
    staffCode: string;
    staffName: string;
    department: Department;
    contractType?: ContractType;
    standardHours: number;
    cells: Record<string, MyCalendarCell>;
    summary: MyCalendarSummary;
  } | null;
  rules: {
    shifts: { SHIFT_1: string; SHIFT_2: string; BOTH?: string };
    lateToleranceMinutes: number;
    overtimeMinMinutes: number;
    holidayWorkPayMultiplier: number;
  };
}

export interface MyLeaveRequest {
  _id: string;
  type: LeaveRequestType;
  date: string;
  fromDate?: string;
  sourceLeaveId?: string;
  sourceOffType?: "OFF" | "PAID_LEAVE";
  reason: string;
  status: LeaveRequestStatus;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt?: string;
}
