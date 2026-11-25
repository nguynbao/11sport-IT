export type CmsModuleType =
  | "INVENTORY"
  | "REVENUE"
  | "CATEGORIES"
  | "ORDERS"
  | "SERVICES"
  | "STAFF"
  | "ACTIVITY"
  | "SHIFT_HANDOVERS"
  | "PROMOTIONS"
  | "DEBTS"
  | "HRM"
  | "MY_ATTENDANCE"
  | "PUSH_PRODUCTS"
  | "PROFILE";

export const ROLE_ALLOWED_MODULES: Record<string, CmsModuleType[]> = {
  CEO: [
    "REVENUE",
    "PUSH_PRODUCTS",
    "INVENTORY",
    "CATEGORIES",
    "ORDERS",
    "SERVICES",
    "STAFF",
    "HRM",
    "SHIFT_HANDOVERS",
    "ACTIVITY",
    "PROMOTIONS",
    "DEBTS",
    "PROFILE",
  ],
  ADMIN: [
    "REVENUE",
    "INVENTORY",
    "CATEGORIES",
    "ORDERS",
    "SERVICES",
    "STAFF",
    "HRM",
    "SHIFT_HANDOVERS",
    "ACTIVITY",
    "PROMOTIONS",
    "DEBTS",
    "PROFILE",
  ],
  ACCOUNTANT: [
    "REVENUE",
    "INVENTORY",
    "CATEGORIES",
    "ORDERS",
    "SERVICES",
    "SHIFT_HANDOVERS",
    "DEBTS",
    "MY_ATTENDANCE",
    "PROFILE",
  ],
  HR: ["HRM", "MY_ATTENDANCE", "PROFILE"],
  MARKETING: ["PUSH_PRODUCTS", "MY_ATTENDANCE", "PROFILE"],
};
