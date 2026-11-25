"use client";

import React, { useState, useEffect } from "react";
import ThemeToggle from "@/shared/ui/ThemeToggle";
import { StaffUser, Order } from "@/shared/types";
import { apiRequest, getStoredUser, getStoredToken, setStoredAuth, clearStoredAuth } from "@/shared/api/client";
import { InventoryModule } from "@/features/inventory";
import { RevenueDashboardModule } from "@/features/reports";
import { CategoryBrandModule } from "@/features/catalog";
import { OrdersReturnsModule } from "@/features/orders";
import { StaffModule } from "@/features/staff";
import { StaffActivityModule } from "@/features/reports";
import { PromotionModule } from "@/features/promotions";
import { DebtManagementModule } from "@/features/orders";
import { HrmAttendanceModule } from "@/features/attendance";
import { ShiftHandoverModule } from "@/features/shifts";
import { MarketingPushProductsModule } from "@/features/reports";
import { AccountProfileModule } from "@/features/staff";
import { ServiceManagementModule } from "@/features/services";
import { MyAttendanceCalendar } from "@/features/attendance";
import { HeaderAttendanceBar } from "@/features/attendance";
import InvoicePdfModal from "@/shared/ui/InvoicePdfModal";
import { AttendanceIpConfigModule } from "@/features/attendance";
import {
  Boxes,
  TrendingUp,
  FolderKanban,
  ShoppingBag,
  Users,
  ShieldCheck,
  ExternalLink,
  LogOut,
  LogIn,
  User,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Activity,
  Gift,
  Wallet,
  Wifi,
  Menu,
  ChevronRight,
  X,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Rocket,
  Wrench,
} from "lucide-react";
import { CMS_MENU_ITEMS } from "@/config/menu";
import { CmsModuleType, ROLE_ALLOWED_MODULES } from "@/config/roles";

export interface CmsChangePasswordModalProps {
  adminUser: StaffUser;
  showChangePwdModal: boolean;
  setShowChangePwdModal: (v: boolean) => void;
  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmNewPassword: string;
  setConfirmNewPassword: (v: string) => void;
  pwdMessage: { type: "success" | "error"; text: string } | null;
  pwdLoading: boolean;
  handleChangePasswordSubmit: (e: React.FormEvent) => void;
}

export function CmsChangePasswordModal({
  adminUser,
  showChangePwdModal,
  setShowChangePwdModal,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmNewPassword,
  setConfirmNewPassword,
  pwdMessage,
  pwdLoading,
  handleChangePasswordSubmit,
}: CmsChangePasswordModalProps) {
  return (
    <>
      {/* Modal Đổi mật khẩu Quản trị viên (Header CMS) */}
      {showChangePwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4 print:hidden">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="font-extrabold text-sm">
                  Đổi mật khẩu Quản trị viên ({adminUser.username})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePwdModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-teal-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="p-5 space-y-4">
              {pwdMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${pwdMessage.type === "success"
                    ? "bg-teal-50 border-teal-200 text-brand-ink"
                    : "bg-red-50 border-red-200 text-red-700"
                    }`}
                >
                  {pwdMessage.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{pwdMessage.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mật khẩu hiện tại *
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu đang sử dụng..."
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mật khẩu mới (Tối thiểu 4 ký tự) *
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePwdModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-bold shadow"
                >
                  {pwdLoading ? "Đang cập nhật..." : "Cập nhật Mật khẩu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}
