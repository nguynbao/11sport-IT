import {
  FileText,
  Package,
  RotateCcw,
  ShoppingCart,
  Users,
  Wrench,
} from "lucide-react";
import type { TabConfig } from "@/shared/ui/DrawerMenu";

export const TABS_CONFIG: TabConfig[] = [
  {
    id: "POS",
    label: "Bán hàng",
    icon: ShoppingCart,
    allowedRoles: ["SALES", "ADMIN", "CEO"],
    roleHint: "NV Bán hàng / Quản lý / Giám đốc",
  },
  {
    id: "SERVICES",
    label: "Làm dịch vụ",
    icon: Wrench,
    allowedRoles: ["SALES", "ADMIN", "CEO"],
    roleHint: "NV Bán hàng / Quản lý / Giám đốc",
  },
  {
    id: "INVENTORY",
    label: "Kho hàng",
    icon: Package,
    allowedRoles: ["SALES", "ADMIN", "CEO"],
    roleHint: "NV Bán hàng / Quản lý / Giám đốc",
  },
  {
    id: "CUSTOMER",
    label: "Khách hàng & PDF",
    icon: Users,
    allowedRoles: ["SALES", "ADMIN", "CEO"],
    roleHint: "NV Bán hàng / Quản lý / Giám đốc",
  },
  {
    id: "RETURN",
    label: "Đổi hàng",
    icon: RotateCcw,
    allowedRoles: ["SALES", "ADMIN", "CEO"],
    roleHint: "NV Bán hàng / Quản lý / Giám đốc",
  },
  {
    id: "INVOICE_HISTORY",
    label: "Lịch sử hoá đơn",
    icon: FileText,
    allowedRoles: ["SALES", "ADMIN", "CEO"],
    roleHint: "NV Bán hàng / Quản lý / Giám đốc",
  },
];
