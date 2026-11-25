"use client";

import type React from "react";
import { ChevronRight, Menu, ShieldCheck } from "lucide-react";
import { CmsModuleType } from "@/config/roles";
import { HeaderAttendanceBar } from "@/features/attendance";
import { StaffUser } from "@/shared/types";

interface CmsHeaderProps {
  adminUser: StaffUser;
  effectiveModule: CmsModuleType;
  currentMenuDisplayLabel: string;
  CurrentIcon: React.ComponentType<{ className?: string }>;
  onOpenLeftDrawer: () => void;
  onOpenRightDrawer: () => void;
  onOpenMyAttendance: () => void;
}

export function CmsHeader({
  adminUser,
  effectiveModule,
  currentMenuDisplayLabel,
  CurrentIcon,
  onOpenLeftDrawer,
  onOpenRightDrawer,
  onOpenMyAttendance,
}: CmsHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white text-slate-900 shadow-2xs print:hidden border-b border-slate-200">
      <div className="max-w-[98vw] 2xl:max-w-[1880px] mx-auto px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Nút mở Drawer Menu */}
          <button
            type="button"
            onClick={onOpenLeftDrawer}
            className="px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
            title="Mở danh mục quản trị CMS (Drawer Menu)"
          >
            <Menu className="w-4 h-4" />
            <span>Menu CMS</span>
          </button>

          <img
            src="/logo-11sport.svg"
            alt="11Sport Logo"
            className="h-9 md:h-10 w-auto object-contain shrink-0 hidden sm:block"
          />

          <div className="border-l border-slate-200 pl-3">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">
                11SPORT CMS
              </span>
              <span className="hidden lg:inline text-[10px] font-mono bg-teal-50 text-brand-ink border border-teal-200 px-2 py-0.5 rounded font-bold">
                v2.0
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenLeftDrawer}
              className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-bold text-brand-ink hover:text-brand-ink transition"
            >
              <CurrentIcon className="w-3.5 h-3.5" />
              <span>Đang mở: {currentMenuDisplayLabel}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-75" />
            </button>
          </div>
        </div>

        {/* Thanh Chấm công trực tiếp nằm ở giữa Header CMS (Play / Pause & Đồng hồ giờ làm) */}
        <div className="flex-1 flex items-center justify-center px-2">
          <HeaderAttendanceBar
            currentUser={adminUser}
            onOpenMyAttendance={onOpenMyAttendance}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenRightDrawer}
            title="Mở Menu Cá Nhân (Chấm công & Thông tin tài khoản)"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition cursor-pointer ${effectiveModule === "PROFILE" || effectiveModule === "MY_ATTENDANCE"
              ? "bg-teal-50 border-teal-300 text-teal-900"
              : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
              }`}
          >
            <ShieldCheck className="w-4 h-4 text-brand-ink" />
            <span className="text-slate-500 hidden md:inline">Nhân sự:</span>
            <strong className="text-slate-900">{adminUser.fullName}</strong>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-600 text-white font-bold">
              {adminUser.role}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenRightDrawer}
            title="Mở Menu Cá Nhân (Chấm công & Thông tin cá nhân)"
            aria-label="Mở Menu Cá Nhân"
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs font-bold text-slate-800 border border-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Menu className="w-4 h-4 text-brand-ink" />
            <span className="hidden sm:inline">Menu</span>
          </button>
        </div>
      </div>
    </header>
  );
}
