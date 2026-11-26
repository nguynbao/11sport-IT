import type React from "react";
import type { UserRole } from "@/shared/types";

export type TabType =
  | "POS"
  | "SERVICES"
  | "INVENTORY"
  | "CUSTOMER"
  | "RETURN"
  | "INVOICE_HISTORY"
  | "PUSH_PRODUCTS";
export type DrawerPageType = "NONE" | "PROFILE" | "ATTENDANCE";

export interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
  roleHint: string;
}
