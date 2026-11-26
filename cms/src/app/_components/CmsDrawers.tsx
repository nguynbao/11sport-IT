"use client";

import { CMS_MENU_ITEMS } from "@/config/menu";
import { CmsModuleType } from "@/config/roles";
import { StaffUser } from "@/shared/types";
import ThemeToggle from "@/shared/ui/ThemeToggle";
import {
CalendarDays,
ChevronRight,
KeyRound,
LogOut,
ShieldCheck,
User,
Wifi,
X
} from "lucide-react";

export interface CmsDrawersProps {
  isRightDrawerOpen: boolean;
  setIsRightDrawerOpen: (v: boolean) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (v: boolean) => void;
  adminUser: StaffUser;
  effectiveModule: CmsModuleType;
  setActiveModule: (m: CmsModuleType) => void;
  visibleMenuItems: (typeof CMS_MENU_ITEMS[number] & { displayLabel: string })[];
  userAllowedModules: CmsModuleType[];
  handleOpenChangePwd: () => void;
  handleLogout: () => void;
  setShowIpConfigModal: (v: boolean) => void;
}

export function CmsDrawers({
  isRightDrawerOpen,
  setIsRightDrawerOpen,
  isDrawerOpen,
  setIsDrawerOpen,
  adminUser,
  effectiveModule,
  setActiveModule,
  visibleMenuItems,
  userAllowedModules,
  handleOpenChangePwd,
  handleLogout,
  setShowIpConfigModal,
}: CmsDrawersProps) {
  return (
    <>
      {/* DRAWER MENU CÁ NHÂN TRƯỢT TỪ BÊN PHẢI (CHẤM CÔNG & THÔNG TIN CÁ NHÂN) */}
      {isRightDrawerOpen && (
        <div
          className="fixed inset-0 z-50 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu tài khoản & cá nhân"
        >
          {/* Lớp nền mờ */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] transition-opacity"
            onClick={() => setIsRightDrawerOpen(false)}
          />

          {/* Nội dung Drawer trượt từ bên phải (Gọn, cân đối) */}
          <aside className="fixed top-0 right-0 bottom-0 w-72 sm:w-80 max-w-[85vw] drawer-dark bg-white text-slate-900 shadow-2xl border-l border-slate-200 flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Header của Drawer */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/logo-11sport.svg"
                  alt="11Sport Logo"
                  className="h-10 w-auto object-contain shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-extrabold text-xs tracking-tight text-slate-900 truncate">
                    TÀI KHOẢN
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    Quản trị CMS
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRightDrawerOpen(false)}
                title="Đóng menu"
                className="p-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thông tin nhân sự gọn */}
            <div className="p-3 border-b border-slate-200 bg-slate-50/70 shrink-0">
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-2.5 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-brand-ink" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-xs text-slate-900 truncate">
                    {adminUser.fullName}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {adminUser.username && (
                      <span className="text-[11px] text-slate-500 font-mono truncate">
                        @{adminUser.username}
                      </span>
                    )}
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-teal-600 text-white font-bold shrink-0">
                      {adminUser.role}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Danh sách tiện ích gọn 1 dòng + Đăng xuất ngay bên dưới */}
            <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3">
              <div className="space-y-0.5">
                <div className="px-2.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Tiện ích nhân sự
                </div>

                {/* 1. Chấm công: Lịch công tháng của tôi */}
                {userAllowedModules.includes("MY_ATTENDANCE") && (
                  <button
                    type="button"
                    title="Lịch công tháng, đơn từ & tăng ca"
                    onClick={() => {
                      setActiveModule("MY_ATTENDANCE");
                      setIsRightDrawerOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition ${effectiveModule === "MY_ATTENDANCE"
                      ? "bg-teal-600 text-white shadow-xs"
                      : "text-slate-700 hover:bg-sky-50 hover:text-brand-ink"
                      }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${effectiveModule === "MY_ATTENDANCE"
                        ? "bg-white/20 text-white"
                        : "bg-sky-50 text-brand-ink"
                        }`}
                    >
                      <CalendarDays className="w-4 h-4" />
                    </span>
                    <span className="flex-1 truncate">Chấm công cá nhân</span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 ${effectiveModule === "MY_ATTENDANCE"
                        ? "text-white"
                        : "text-slate-400"
                        }`}
                    />
                  </button>
                )}

                {/* 2. Thông tin tài khoản cá nhân */}
                <button
                  type="button"
                  title="Xem hồ sơ & chỉnh sửa thông tin cá nhân"
                  onClick={() => {
                    setActiveModule("PROFILE");
                    setIsRightDrawerOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition ${effectiveModule === "PROFILE"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-700 hover:bg-teal-50 hover:text-brand-ink"
                    }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${effectiveModule === "PROFILE"
                      ? "bg-white/20 text-white"
                      : "bg-teal-50 text-brand-ink"
                      }`}
                  >
                    <User className="w-4 h-4" />
                  </span>
                  <span className="flex-1 truncate">Hồ sơ tài khoản</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 ${effectiveModule === "PROFILE"
                      ? "text-white"
                      : "text-slate-400"
                      }`}
                  />
                </button>

                {/* Chế độ sáng/tối */}
                <ThemeToggle />

                {/* 3. Đổi mật khẩu */}
                <button
                  type="button"
                  title="Cập nhật mật khẩu đăng nhập CMS"
                  onClick={() => {
                    setIsRightDrawerOpen(false);
                    handleOpenChangePwd();
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 text-slate-700 hover:bg-teal-50 hover:text-brand-ink transition"
                >
                  <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <span className="flex-1 truncate">Đổi mật khẩu</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                </button>

                {/* 4. Cấu hình IP Wi-Fi Chấm công (HR, ADMIN, CEO) */}
                {adminUser && ["HR", "ADMIN", "CEO"].includes(adminUser.role) && (
                  <button
                    type="button"
                    title="IP 2 cơ sở (Showroom & Văn phòng)"
                    onClick={() => {
                      setIsRightDrawerOpen(false);
                      setShowIpConfigModal(true);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 text-slate-700 hover:bg-indigo-50 hover:text-brand-ink transition"
                  >
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 text-brand-ink flex items-center justify-center shrink-0">
                      <Wifi className="w-4 h-4" />
                    </span>
                    <span className="flex-1 truncate">IP Wi-Fi chấm công</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  </button>
                )}
              </div>

              {/* Nút Đăng xuất đặt gọn ngay sau danh sách tiện ích */}
              <div className="pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsRightDrawerOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 text-xs font-extrabold flex items-center justify-center gap-2 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* DRAWER MENU TRƯỢT TỪ BÊN TRÁI */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex print:hidden">
          {/* Lớp nền mờ */}
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Nội dung Drawer (gọn, phân nhóm rõ ràng) */}
          <aside className="relative z-10 w-72 sm:w-80 max-w-[85vw] drawer-dark bg-white text-slate-900 h-full shadow-2xl border-r border-slate-200 flex flex-col">
            {/* Đầu Drawer */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/logo-11sport.svg"
                  alt="11Sport Logo"
                  className="h-10 w-auto object-contain shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-extrabold text-xs tracking-tight text-slate-900 truncate">
                    MENU CMS
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    Chọn phân hệ
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition shrink-0"
                title="Đóng menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Danh sách Module phân nhóm gọn gàng */}
            <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3.5">
              {(
                [
                  {
                    title: "Báo cáo & Marketing",
                    ids: ["REVENUE", "PUSH_PRODUCTS", "PROMOTIONS"] as CmsModuleType[],
                  },
                  {
                    title: "Kho & Sản phẩm",
                    ids: ["INVENTORY", "CATEGORIES"] as CmsModuleType[],
                  },
                  {
                    title: "Bán hàng & Công nợ",
                    ids: ["ORDERS", "SERVICES", "DEBTS"] as CmsModuleType[],
                  },
                  {
                    title: "Nhân sự & Vận hành",
                    ids: ["STAFF", "HRM", "SHIFT_HANDOVERS", "ACTIVITY"] as CmsModuleType[],
                  },
                ]
              ).map((group) => {
                const groupItems = visibleMenuItems.filter((it) =>
                  group.ids.includes(it.id)
                );
                if (groupItems.length === 0) return null;
                return (
                  <div key={group.title} className="space-y-0.5">
                    <div className="px-2.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {group.title}
                    </div>
                    {groupItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = effectiveModule === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          title={item.desc}
                          onClick={() => {
                            setActiveModule(item.id);
                            setIsDrawerOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-xl transition flex items-center gap-2.5 ${
                            isActive
                              ? "bg-teal-600 text-white shadow-xs"
                              : "text-slate-700 hover:bg-teal-50 hover:text-brand-ink"
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-teal-50 text-brand-ink"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="flex-1 min-w-0 text-xs font-bold truncate">
                            {item.displayLabel}
                          </span>
                          {isActive && (
                            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

    </>
  );
}
