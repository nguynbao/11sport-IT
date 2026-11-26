"use client";

import React from "react";
import {
  CalendarCheck,
  LayoutGrid,
  Package,
  Rocket,
  RotateCcw,
  ShoppingCart,
  User,
  Wrench,
} from "lucide-react";
import type { StaffUser } from "@/shared/types";
import type { DrawerPageType, TabType } from "@/shared/ui/DrawerMenu";

interface WebBottomNavbarProps {
  currentUser: StaffUser;
  activeTab: TabType;
  activeDrawerPage: DrawerPageType;
  hasUnseenShiftSchedule: boolean;
  onSelectTab: (tabId: TabType) => void;
  onOpenAttendance: () => void;
  onOpenLeftDrawer: () => void;
  onOpenRightDrawer: () => void;
}

interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  badge?: boolean;
  onClick: () => void;
}

export default function WebBottomNavbar({
  currentUser,
  activeTab,
  activeDrawerPage,
  hasUnseenShiftSchedule,
  onSelectTab,
  onOpenAttendance,
  onOpenLeftDrawer,
  onOpenRightDrawer,
}: WebBottomNavbarProps) {
  const isMarketing = currentUser.role === "MARKETING";
  const isMoreTabActive =
    activeDrawerPage === "NONE" &&
    (activeTab === "CUSTOMER" || activeTab === "INVOICE_HISTORY");

  const items: NavItem[] = isMarketing
    ? [
        {
          key: "PUSH_PRODUCTS",
          label: "Đẩy bán",
          icon: Rocket,
          active: activeDrawerPage === "NONE" && activeTab === "PUSH_PRODUCTS",
          onClick: () => onSelectTab("PUSH_PRODUCTS"),
        },
        {
          key: "ATTENDANCE",
          label: "Chấm công",
          icon: CalendarCheck,
          active: activeDrawerPage === "ATTENDANCE",
          badge: hasUnseenShiftSchedule,
          onClick: onOpenAttendance,
        },
        {
          key: "UTILITIES",
          label: "Tiện ích",
          icon: User,
          active: activeDrawerPage === "PROFILE",
          badge: hasUnseenShiftSchedule,
          onClick: onOpenRightDrawer,
        },
      ]
    : [
        {
          key: "POS",
          label: "Bán hàng",
          icon: ShoppingCart,
          active: activeDrawerPage === "NONE" && activeTab === "POS",
          onClick: () => onSelectTab("POS"),
        },
        {
          key: "SERVICES",
          label: "Dịch vụ",
          icon: Wrench,
          active: activeDrawerPage === "NONE" && activeTab === "SERVICES",
          onClick: () => onSelectTab("SERVICES"),
        },
        {
          key: "INVENTORY",
          label: "Kho",
          icon: Package,
          active: activeDrawerPage === "NONE" && activeTab === "INVENTORY",
          onClick: () => onSelectTab("INVENTORY"),
        },
        {
          key: "RETURN",
          label: "Đổi hàng",
          icon: RotateCcw,
          active: activeDrawerPage === "NONE" && activeTab === "RETURN",
          onClick: () => onSelectTab("RETURN"),
        },
        {
          key: "MORE",
          label: "Thêm",
          icon: LayoutGrid,
          active: isMoreTabActive,
          badge: hasUnseenShiftSchedule,
          onClick: onOpenLeftDrawer,
        },
      ];

  return (
    <nav
      aria-label="Điều hướng nhanh trên di động"
      className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-safe print:hidden"
    >
      <div
        className={`grid ${items.length === 3 ? "grid-cols-3" : "grid-cols-5"} items-stretch`}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              aria-current={item.active ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[56px] px-1 py-1.5 transition-colors cursor-pointer select-none ${
                item.active
                  ? "bg-blue-50/90 text-brand-ink"
                  : "text-slate-500 hover:text-slate-800 active:bg-slate-100"
              }`}
            >
              {item.active && (
                <span className="absolute top-0 left-3 right-3 h-[3px] rounded-b-full bg-blue-600" />
              )}
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge && (
                  <span className="absolute -top-0.5 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold leading-tight truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
