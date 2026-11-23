"use client";

import React, { useEffect } from "react";
import ThemeToggle from "./ThemeToggle";
import { StaffUser, UserRole } from "@/lib/api";
import {
  ShieldCheck,
  ExternalLink,
  LogOut,
  X,
  ChevronRight,
  Clock,
  UserCog,
  Rocket,
  KeyRound,
  Lock,
} from "lucide-react";

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

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  side?: "left" | "right";
  currentUser: StaffUser;
  tabs?: TabConfig[];
  activeTab?: TabType;
  onSelectTab?: (tabId: TabType) => void;
  activeDrawerPage: DrawerPageType;
  onOpenProfile: () => void;
  onOpenAttendance: () => void;
  onOpenPushProducts?: () => void;
  onOpenChangePassword?: () => void;
  onLogout: () => void;
  getRoleDisplayName: (role?: UserRole) => string;
  cmsUrl?: string;
  hasAttendanceNoti?: boolean;
}

export default function DrawerMenu({
  isOpen,
  onClose,
  side = "right",
  currentUser,
  tabs = [],
  activeTab,
  onSelectTab,
  activeDrawerPage,
  onOpenProfile,
  onOpenAttendance,
  onOpenPushProducts,
  onOpenChangePassword,
  onLogout,
  getRoleDisplayName,
  cmsUrl = "https://11sport-it-m1ei.vercel.app",
  hasAttendanceNoti = false,
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

  const isLeft = side === "left";

  return (
    <div
      className="fixed inset-0 z-50 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={
        isLeft ? "Menu điều hướng 5 tab" : "Menu tiện ích nhân sự & tài khoản"
      }
    >
      {/* Lớp nền mờ */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Nội dung Drawer (trái: 5 tab chức năng, phải: tiện ích nhân sự) */}
      <aside
        className={`fixed top-0 bottom-0 w-80 max-w-[85vw] drawer-dark bg-white text-slate-900 shadow-2xl border-slate-200 flex flex-col z-10 duration-200 ${
          isLeft
            ? "left-0 border-r animate-in slide-in-from-left"
            : "right-0 border-l animate-in slide-in-from-right"
        }`}
      >
        {/* Header của Drawer */}
        <div className="px-4 py-3.5 bg-slate-50 border-t-4 border-t-blue-600 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo-11sport.svg"
              alt="11Sport Logo"
              className="h-10 w-auto object-contain shrink-0"
            />
            <div className="min-w-0">
              <div className="font-extrabold text-xs tracking-tight text-slate-900 truncate">
                {isLeft ? "MENU CHÍNH" : "TÀI KHOẢN"}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                11Sport POS & Kho
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Đóng menu"
            className="w-9 h-9 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thông tin nhân sự gọn */}
        {!isLeft && (
          <div className="p-3 border-b border-slate-200 bg-slate-50/70">
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-2.5 shadow-2xs">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-brand-ink" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-xs text-slate-900 truncate">
                  {currentUser.fullName}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {currentUser.username && (
                    <span className="text-[11px] text-slate-500 font-mono truncate">
                      @{currentUser.username}
                    </span>
                  )}
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold shrink-0">
                    {getRoleDisplayName(currentUser.role)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nội dung chính của Drawer */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {isLeft ? (
            /* DRAWER TRÁI: HIỂN THỊ CÁC TAB CHỨC NĂNG BÁN HÀNG, DỊCH VỤ & KHO */
            <div className="space-y-1.5">
              <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Chức năng chính
              </div>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isAllowed =
                  currentUser.role === "CEO" ||
                  currentUser.role === "ADMIN" ||
                  tab.allowedRoles.includes(currentUser.role);
                const isActive =
                  activeDrawerPage === "NONE" && activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={!isAllowed}
                    title={
                      isAllowed
                        ? tab.label
                        : `Chức năng này chỉ dành cho: ${tab.roleHint}`
                    }
                    onClick={() => {
                      if (isAllowed && onSelectTab) {
                        onSelectTab(tab.id);
                        onClose();
                      }
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2.5 transition ${
                      !isAllowed
                        ? "opacity-45 cursor-not-allowed text-slate-400 bg-slate-50"
                        : isActive
                          ? "bg-blue-600 text-white font-extrabold shadow-xs"
                          : "text-slate-700 hover:bg-blue-50 hover:text-brand-ink"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-blue-50 text-brand-ink"
                        }`}
                      >
                        {isAllowed ? (
                          <Icon className="w-4 h-4" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <span className="truncate">{tab.label}</span>
                    </div>
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* DRAWER PHẢI: TIỆN ÍCH NHÂN SỰ & QUẢN TRỊ GỌN */
            <div className="space-y-3">
              <div className="space-y-0.5">
                <div className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Tiện ích nhân sự
                </div>

                {(currentUser.role === "MARKETING" ||
                  currentUser.role === "CEO" ||
                  currentUser.role === "ADMIN") &&
                  onOpenPushProducts && (
                    <button
                      type="button"
                      title="Quan sát tồn kho cao, bán chậm & đọng vốn"
                      onClick={() => {
                        onOpenPushProducts();
                        onClose();
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition ${
                        activeDrawerPage === "NONE" &&
                        activeTab === "PUSH_PRODUCTS"
                          ? "bg-blue-600 text-white font-extrabold shadow-xs"
                          : "text-slate-700 hover:bg-blue-50 hover:text-brand-ink"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          activeDrawerPage === "NONE" &&
                          activeTab === "PUSH_PRODUCTS"
                            ? "bg-white/20 text-white"
                            : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        <Rocket className="w-4 h-4" />
                      </span>
                      <span className="flex-1 truncate">SP Cần đẩy mạnh</span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 ${
                          activeDrawerPage === "NONE" &&
                          activeTab === "PUSH_PRODUCTS"
                            ? "text-white"
                            : "text-slate-400"
                        }`}
                      />
                    </button>
                  )}

                {/* 1. Chấm công: Lịch công tháng của tôi */}
                <button
                  type="button"
                  title="Lịch công tháng, đơn từ & tăng ca"
                  onClick={() => {
                    onOpenAttendance();
                    onClose();
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition ${
                    activeDrawerPage === "ATTENDANCE"
                      ? "bg-blue-600 text-white font-extrabold shadow-xs"
                      : "text-slate-700 hover:bg-blue-50 hover:text-brand-ink"
                  }`}
                >
                  <span
                    className={`relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      activeDrawerPage === "ATTENDANCE"
                        ? "bg-white/20 text-white"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    {hasAttendanceNoti && (
                      <span
                        title="HR đã hoàn thành xếp ca tuần sau"
                        className="absolute -top-1 -right-1 flex h-2.5 w-2.5"
                      >
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                      </span>
                    )}
                  </span>
                  <span className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="truncate">Chấm công cá nhân</span>
                    {hasAttendanceNoti && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black leading-none shrink-0">
                        Mới
                      </span>
                    )}
                  </span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 ${
                      activeDrawerPage === "ATTENDANCE"
                        ? "text-white"
                        : "text-slate-400"
                    }`}
                  />
                </button>

                {/* 2. Thông tin tài khoản */}
                <button
                  type="button"
                  title="Xem hồ sơ & chỉnh sửa thông tin cá nhân"
                  onClick={() => {
                    onOpenProfile();
                    onClose();
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition ${
                    activeDrawerPage === "PROFILE"
                      ? "bg-blue-600 text-white font-extrabold shadow-xs"
                      : "text-slate-700 hover:bg-blue-50 hover:text-brand-ink"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      activeDrawerPage === "PROFILE"
                        ? "bg-white/20 text-white"
                        : "bg-blue-50 text-brand-ink"
                    }`}
                  >
                    <UserCog className="w-4 h-4" />
                  </span>
                  <span className="flex-1 truncate">Hồ sơ tài khoản</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 ${
                      activeDrawerPage === "PROFILE"
                        ? "text-white"
                        : "text-slate-400"
                    }`}
                  />
                </button>

                {/* Chế độ sáng/tối */}
                <ThemeToggle />

                {/* 3. Đổi mật khẩu */}
                {onOpenChangePassword && (
                  <button
                    type="button"
                    title="Cập nhật mật khẩu đăng nhập hệ thống"
                    onClick={() => {
                      onClose();
                      onOpenChangePassword();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 text-slate-700 hover:bg-blue-50 hover:text-brand-ink transition"
                  >
                    <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <KeyRound className="w-4 h-4" />
                    </span>
                    <span className="flex-1 truncate">Đổi mật khẩu</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  </button>
                )}
              </div>

              {(currentUser.role === "ADMIN" || currentUser.role === "CEO") && (
                <div className="space-y-1 pt-2 border-t border-slate-200">
                  <div className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Quản trị
                  </div>
                  <a
                    href={cmsUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={onClose}
                    className="w-full px-2.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-xs font-bold text-brand-ink border border-blue-200 flex items-center justify-between gap-2 transition"
                  >
                    <span>Mở trang Quản trị CMS</span>
                    <ExternalLink className="w-4 h-4 shrink-0" />
                  </a>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 pb-safe">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 text-xs font-extrabold flex items-center justify-center gap-2 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
