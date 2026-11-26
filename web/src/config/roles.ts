import type { UserRole } from "@/shared/types";
import type { TabType } from "@/shared/ui/DrawerMenu";

export function getDefaultTabForRole(role: UserRole): TabType {
  if (role === "MARKETING") return "PUSH_PRODUCTS";
  return "POS";
}

export function isBlockedFromWebPos(role?: UserRole): boolean {
  return role === "HR" || role === "ACCOUNTANT";
}

export function isAttendanceOnlyRole(_role?: UserRole): boolean {
  return false;
}

export function getRoleDisplayName(role?: UserRole): string {
  if (role === "CEO") return "Giám đốc (CEO)";
  if (role === "ADMIN") return "Quản lý (ADMIN)";
  if (role === "HR") return "Nhân sự (HR)";
  if (role === "ACCOUNTANT") return "Kế toán (ACCOUNTANT)";
  if (role === "MARKETING") return "Marketing (MARKETING)";
  return "NV Bán hàng (SALES)";
}

export const EXCHANGE_DOWNGRADE_OVERRIDE_ROLES = ["CEO", "ADMIN"] as const;

export function canOverrideExchangeDowngrade(role?: string): boolean {
  return (EXCHANGE_DOWNGRADE_OVERRIDE_ROLES as readonly string[]).includes(
    String(role || "").toUpperCase()
  );
}
