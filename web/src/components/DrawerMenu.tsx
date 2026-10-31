"use client";

import React, { useEffect } from "react";
import { StaffUser, UserRole } from "@/lib/api";
import {
  ShieldCheck,
  ExternalLink,
  LogOut,
  X,
  ChevronRight,
  Clock,
  UserCog,
} from "lucide-react";

export type TabType = "POS" | "INVENTORY" | "IMPORT" | "CUSTOMER" | "RETURN";
export type DrawerPageType = "NONE" | "PROFILE" | "ATTENDANCE";

export interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
  roleHint: string;
}

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: StaffUser;
  activeDrawerPage: DrawerPageType;
  onOpenProfile: () => void;
  onOpenAttendance: () => void;
  onLogout: () => void;
  getRoleDisplayName: (role?: UserRole) => string;
  cmsUrl?: string;
}

export default function DrawerMenu({
  isOpen,
  onClose,
  currentUser,
  activeDrawerPage,
  onOpenProfile,
  onOpenAttendance,
  onLogout,
  getRoleDisplayName,
  cmsUrl = "https://11sport-it-m1ei.vercel.app",
}: DrawerMenuProps) {
  // Đóng drawer khi nhấn phím Escape & khóa cuộn trang nền khi mở
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu tài khoản & cá nhân"
    >
      {/* Lớp nền mờ */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Nội dung Drawer trượt từ bên phải */}
      <aside className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-slate-900 text-white shadow-2xl border-l border-slate-800 flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header của Drawer */}
        <div className="px-4 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo-11sport-white.svg"
              alt="11Sport Logo"
              className="h-9 w-auto object-contain shrink-0"
            />
            <div className="min-w-0">
              <div className="font-extrabold text-sm tracking-tight truncate">
                MENU CÁ NHÂN
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                11Sport POS & Kho vận
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Đóng menu"
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thông tin nhân sự đang đăng nhập */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60">
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-400">Đang đăng nhập:</div>
              <div className="font-bold text-sm text-white truncate">
                {currentUser.fullName}
              </div>
              {currentUser.username && (
                <div className="text-[11px] text-slate-400 font-mono truncate">
                  @{currentUser.username}
                </div>
              )}
              <div className="mt-1.5 inline-block font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">
                {getRoleDisplayName(currentUser.role)}
              </div>
            </div>
          </div>
        </div>

        {/* Danh sách tiện ích cá nhân: Chấm công & Thông tin tài khoản */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="space-y-1.5">
            <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tiện ích nhân sự
            </div>

            {/* 1. Chấm công (chưa implement) */}
            <button
              type="button"
              onClick={() => {
                onOpenAttendance();
                onClose();
              }}
              className={`w-full text-left px-3 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2.5 transition ${
                activeDrawerPage === "ATTENDANCE"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-200 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    activeDrawerPage === "ATTENDANCE"
                      ? "bg-white/20 text-white"
                      : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">Chấm công</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                        activeDrawerPage === "ATTENDANCE"
                          ? "bg-white/20 text-white"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      Sắp ra mắt
                    </span>
                  </div>
                  <div
                    className={`text-[10px] font-normal truncate mt-0.5 ${
                      activeDrawerPage === "ATTENDANCE"
                        ? "text-emerald-100"
                        : "text-slate-400"
                    }`}
                  >
                    Điểm danh ca làm việc (chưa triển khai)
                  </div>
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 shrink-0 ${
                  activeDrawerPage === "ATTENDANCE"
                    ? "text-white"
                    : "text-slate-500"
                }`}
              />
            </button>

            {/* 2. Thông tin tài khoản */}
            <button
              type="button"
              onClick={() => {
                onOpenProfile();
                onClose();
              }}
              className={`w-full text-left px-3 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2.5 transition ${
                activeDrawerPage === "PROFILE"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-200 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    activeDrawerPage === "PROFILE"
                      ? "bg-white/20 text-white"
                      : "bg-emerald-500/15 text-emerald-400"
                  }`}
                >
                  <UserCog className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate">Thông tin tài khoản</div>
                  <div
                    className={`text-[10px] font-normal truncate mt-0.5 ${
                      activeDrawerPage === "PROFILE"
                        ? "text-emerald-100"
                        : "text-slate-400"
                    }`}
                  >
                    Xem hồ sơ & chỉnh sửa thông tin cá nhân
                  </div>
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 shrink-0 ${
                  activeDrawerPage === "PROFILE"
                    ? "text-white"
                    : "text-slate-500"
                }`}
              />
            </button>
          </div>

          {currentUser.role === "ADMIN" && (
            <div className="space-y-1 pt-2 border-t border-slate-800">
              <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Quản trị hệ thống
              </div>
              <a
                href={cmsUrl}
                target="_blank"
                rel="noreferrer"
                onClick={onClose}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-bold text-emerald-400 border border-slate-700/80 flex items-center justify-between gap-2 transition"
              >
                <span>Mở trang Quản trị CMS</span>
                <ExternalLink className="w-4 h-4 shrink-0" />
              </a>
            </div>
          )}
        </div>

        {/* Footer của Drawer: Nút Đăng xuất */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 pb-safe">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất tài khoản</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
