/**
 * Centralized registry of all CMS API endpoints (backend + Next.js local routes + printer server).
 * Use these constants/builders instead of hardcoding path strings in features or hooks.
 */
export const API_ENDPOINTS = {
  HEALTH: "/health",
  VERSION: "/api/version",

  PRINTERS: {
    NEXT_API: "/api/printers",
    LOCAL_LIST: [
      "/api/v1/system/printers",
      "/api/v1/printers",
    ] as readonly string[],
    LOCAL_PRINT_LABELS: [
      "/api/v1/system/printers/print-labels",
      "/api/v1/printers/print-labels",
    ] as readonly string[],
  },

  AUTH: {
    LOGIN: "/auth/login",
    CHANGE_PASSWORD: "/auth/change-password",
  },

  STAFF: {
    BASE: "/staff",
    byId: (id: string) => `/staff/${id}`,
    PARSE_IMPORT_FILE: "/staff/parse-import-file",
  },

  CATEGORIES: {
    BASE: "/categories",
    byId: (id: string) => `/categories/${id}`,
  },

  BRANDS: {
    BASE: "/brands",
    byId: (id: string) => `/brands/${id}`,
  },

  PRODUCTS: {
    BASE: "/products",
    byId: (id: string) => `/products/${id}`,
    LOOKUP: "/products/lookup",
    PREVIEW_CODE: "/products/preview-code",
  },

  IMPORTS: {
    BASE: "/imports",
    byId: (id: string) => `/imports/${id}`,
    PARSE_FILE: "/imports/parse-file",
  },

  INVENTORY: {
    REPORT: "/inventory/report",
    MOVEMENTS: "/inventory/movements",
    TRANSFERS: "/inventory/transfers",
    UNPACK_SET: "/inventory/unpack-set",
  },

  ORDERS: {
    BASE: "/orders",
    byId: (id: string) => `/orders/${id}`,
    debtPayment: (id: string) => `/orders/${id}/debt-payment`,
  },

  RETURNS: {
    BASE: "/returns",
    CALCULATE: "/returns/calculate",
  },

  PROMOTIONS: {
    BASE: "/promotions",
    byId: (id: string) => `/promotions/${id}`,
  },

  SERVICES: {
    TYPES: "/service-types",
    typeById: (id: string) => `/service-types/${id}`,
    ORDERS: "/service-orders",
    orderById: (id: string) => `/service-orders/${id}`,
    orderStatus: (id: string) => `/service-orders/${id}/status`,
    orderPayments: (id: string) => `/service-orders/${id}/payments`,
  },

  REPORTS: {
    REVENUE_DASHBOARD: "/reports/revenue-dashboard",
    PUSH_PRODUCTS: "/reports/push-products",
    STAFF_ACTIVITY: "/reports/staff-activity",
  },

  ATTENDANCE: {
    CONFIG: "/attendance/config",
    TODAY: "/attendance/today",
    CHECK_IN: "/attendance/check-in",
    CHECK_OUT: "/attendance/check-out",
    MANUAL: "/attendance/manual",
    byId: (id: string) => `/attendance/${id}`,
    HISTORY: "/attendance/history",
    MY_CALENDAR: "/attendance/my-calendar",
    TIMESHEET: "/attendance/timesheet",
  },

  HOLIDAYS: {
    BASE: "/holidays",
    byId: (id: string) => `/holidays/${id}`,
    SYNC_VN: "/holidays/sync-vn",
  },

  LEAVE_REQUESTS: {
    BASE: "/leave-requests",
    byId: (id: string) => `/leave-requests/${id}`,
  },

  SHIFTS: {
    SCHEDULE: "/shifts/schedule",
    ASSIGN: "/shifts/assign",
    ASSIGN_BULK: "/shifts/assign/bulk",
    HANDOVER: "/shifts/handover",
    handoverById: (id: string) => `/shifts/handover/${id}`,
    HANDOVER_DAILY_CHECK: "/shifts/handover/daily-check",
    HANDOVER_SCHEDULE_CONFIG: "/shifts/handover/schedule-config",
  },
} as const;
