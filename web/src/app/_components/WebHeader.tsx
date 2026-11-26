"use client";

import React from "react";
import { Menu, ShieldCheck, User } from "lucide-react";
import type { StaffUser } from "@/shared/types";
import type { DrawerPageType, TabConfig } from "@/shared/ui/DrawerMenu";
import { HeaderAttendanceBar } from "@/features/attendance";
import { getRoleDisplayName } from "@/config/roles";

interface WebHeaderProps {
  currentUser: StaffUser;
  activeDrawerPage: DrawerPageType;
  currentTabConfig?: TabConfig;
  hasUnseenShiftSchedule: boolean;
  onOpenLeftDrawer: () => void;
  onOpenRightDrawer: () => void;
}

export default function WebHeader({
  currentUser,
  activeDrawerPage,
  currentTabConfig,
  hasUnseenShiftSchedule,
  onOpenLeftDrawer,
  onOpenRightDrawer,
}: WebHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white text-slate-900 border-b border-slate-200 shadow-2xs print:hidden">
      <div className="w-full mx-auto px-2 sm:px-3 lg:px-4 py-2 md:py-2.5 flex items-center justify-between gap-2 md:gap-3">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenLeftDrawer}
            title="Mở menu điều hướng 5 tab"
            aria-label="Mở menu điều hướng 5 tab"
            className="relative min-h-[40px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-extrabold text-white shadow-xs flex items-center justify-center gap-2 transition shrink-0 cursor-pointer"
          >
            <Menu className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">
              {activeDrawerPage === "PROFILE"
                ? "Tài khoản"
                : activeDrawerPage === "ATTENDANCE"
                  ? "Chấm công"
                  : currentTabConfig?.label || "Menu"}
            </span>
          </button>

          <img
            src="/logo-11sport.svg"
            alt="11Sport Logo"
            className="h-8 md:h-10 w-auto object-contain shrink-0"
          />
          <div className="min-w-0 hidden sm:block">
            <div className="font-extrabold text-sm md:text-base tracking-tight text-slate-900 flex items-center gap-2 truncate">
              <span className="truncate">11SPORT POS & KHO VẬN</span>
              <span className="hidden lg:inline text-[11px] font-mono bg-blue-50 text-brand-ink border border-blue-200 px-2 py-0.5 rounded font-bold">
                v2.0
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-1">
          <HeaderAttendanceBar currentUser={currentUser} />
        </div>

        <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenRightDrawer}
            title="Mở Tiện ích nhân sự & tài khoản"
            className={`hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl border transition cursor-pointer ${
              activeDrawerPage === "PROFILE" || activeDrawerPage === "ATTENDANCE"
                ? "bg-blue-50 border-blue-300 text-blue-900"
                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-brand-ink" />
            <div className="text-xs">
              <span className="text-slate-500">Nhân sự: </span>
              <strong className="text-slate-900">{currentUser.fullName}</strong>{" "}
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white font-bold ml-1">
                {getRoleDisplayName(currentUser.role)}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenRightDrawer}
            title="Tiện ích nhân sự"
            aria-label="Mở tiện ích nhân sự"
            className="relative min-h-[40px] min-w-[40px] px-2.5 md:px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs font-bold text-slate-800 border border-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <User className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-brand-ink" />
            <span className="hidden sm:inline">Tiện ích</span>
            {hasUnseenShiftSchedule && (
              <span
                title="HR đã hoàn thành xếp ca tuần mới"
                className="absolute -top-1 -right-1 flex h-3 w-3"
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 border border-white" />
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
