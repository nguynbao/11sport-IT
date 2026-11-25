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

export interface CmsAuthGateProps {
  checkingAuth: boolean;
  adminUser: StaffUser | null;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loginError: string;
  loginLoading: boolean;
  handleLoginSubmit: (e: React.FormEvent) => void;
}

export function CmsAuthGate({
  checkingAuth,
  adminUser,
  username,
  setUsername,
  password,
  setPassword,
  loginError,
  loginLoading,
  handleLoginSubmit,
}: CmsAuthGateProps) {
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <div className="text-sm font-semibold text-slate-600">
          Đang kiểm tra phiên đăng nhập Quản trị...
        </div>
      </div>
    );
  }

  // Màn hình Đăng nhập CMS (Chỉ dành cho ADMIN)
  if (!adminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-teal-50/70 to-white px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-white text-slate-900 px-6 py-6 text-center border-b border-slate-100">
            <img
              src="/logo-11sport.svg"
              alt="11Sport Logo"
              className="h-16 w-auto object-contain mx-auto mb-3"
            />
            <h1 className="text-xl font-extrabold tracking-tight">
              ĐĂNG NHẬP QUẢN TRỊ 11SPORT (CMS)
            </h1>
          </div>

          <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Tài khoản Quản trị (Username)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập username"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Mật khẩu (Password)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  autoComplete="current-password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition"
            >
              <LogIn className="w-4 h-4" />
              {loginLoading ? "Đang xác thực..." : "Đăng nhập CMS"}
            </button>
          </form>
        </div>
      </div>
    );
  }
  return null;
}
