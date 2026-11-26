/**
 * Centralized registry of all Web POS API endpoints.
 */
export const API_ENDPOINTS = {
  HEALTH: "/health",
  VERSION: "/api/version",
  WISE_RATE: "/api/wise-rate",

  PRINTERS: {
    NEXT_API: "/api/printers",
  },

  AUTH: {
    LOGIN: "/auth/login",
    CHANGE_PASSWORD: "/auth/change-password",
  },

  CATEGORIES: {
    BASE: "/categories",
  },

  BRANDS: {
    BASE: "/brands",
  },

  PRODUCTS: {
    BASE: "/products",
    byId: (id: string) => `/products/${id}`,
    variants: (id: string) => `/products/${id}/variants`,
    LOOKUP: "/products/lookup",
    PREVIEW_CODE: "/products/preview-code",
  },

  ORDERS: {
    BASE: "/orders",
    CURRENT_SHIFT: "/orders/current-shift",
    byId: (id: string) => `/orders/${id}`,
  },

  RETURNS: {
    BASE: "/returns",
  },

  ATTENDANCE: {
    TODAY: "/attendance/today",
    CHECK_IN: "/attendance/check-in",
    CHECK_OUT: "/attendance/check-out",
    MY_CALENDAR: "/attendance/my-calendar",
  },

  LEAVE_REQUESTS: {
    BASE: "/leave-requests",
    MINE: "/leave-requests?mine=true",
    byId: (id: string) => `/leave-requests/${id}`,
  },

  SHIFTS: {
    PREFERENCES: "/shifts/preferences",
    MY_SCHEDULE: "/shifts/my-schedule",
    MY_SCHEDULE_SEEN: "/shifts/my-schedule/seen",
    HANDOVER: "/shifts/handover",
    handoverConfirm: (id: string) => `/shifts/handover/${id}/confirm`,
    HANDOVER_DAILY_CHECK: "/shifts/handover/daily-check",
  },
} as const;
