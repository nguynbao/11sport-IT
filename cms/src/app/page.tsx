"use client";

import React, { useState, useEffect } from "react";
import {
  StaffUser,
  Order,
  apiRequest,
  getStoredUser,
  getStoredToken,
  setStoredAuth,
  clearStoredAuth,
} from "@/lib/api";
import InventoryModule from "@/components/InventoryModule";
import CategoryModule from "@/components/CategoryModule";
import OrdersReturnsModule from "@/components/OrdersReturnsModule";
import StaffModule from "@/components/StaffModule";
import StaffActivityModule from "@/components/StaffActivityModule";
import InvoicePdfModal from "@/components/InvoicePdfModal";
import {
  Boxes,
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
  Activity,
} from "lucide-react";

type CmsModuleType = "INVENTORY" | "CATEGORIES" | "ORDERS" | "STAFF" | "ACTIVITY";

export default function CmsDashboardPage() {
  const [activeModule, setActiveModule] = useState<CmsModuleType>("INVENTORY");
  const [adminUser, setAdminUser] = useState<StaffUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  // State form Login CMS
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const saved = getStoredUser();
    const token = getStoredToken();
    if (saved && token && token !== "demo-admin-token" && saved.role === "ADMIN") {
      setAdminUser(saved);
    } else {
      clearStoredAuth();
    }
    setCheckingAuth(false);
  }, []);

  // Định kỳ 8 phút gửi 1 API đánh thức server chống sleep (5-10 phút/lần)
  useEffect(() => {
    apiRequest("/health").catch(() => {});
    const timer = setInterval(() => {
      apiRequest("/health").catch(() => {});
    }, 8 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!username.trim() || !password) {
      setLoginError("Vui lòng nhập Tên đăng nhập và Mật khẩu Quản trị.");
      return;
    }

    setLoginLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: StaffUser }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        }
      );
      if (res.data?.token && res.data?.user) {
        if (res.data.user.role !== "ADMIN") {
          setLoginError(
            `Tài khoản "${res.data.user.username}" có vai trò ${res.data.user.role}. Chỉ Quản lý (ADMIN) mới được phép truy cập CMS!`
          );
          return;
        }
        setStoredAuth(res.data.token, res.data.user);
        setAdminUser(res.data.user);
        setPassword("");
      }
    } catch (err: any) {
      setLoginError(err?.message || "Sai thông tin đăng nhập hoặc tài khoản bị khóa.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAdminUser(null);
    setUsername("");
    setPassword("");
    setLoginError("");
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-sm font-semibold text-slate-300">
          Đang kiểm tra phiên đăng nhập Quản trị...
        </div>
      </div>
    );
  }

  // Màn hình Đăng nhập CMS (Chỉ dành cho ADMIN)
  if (!adminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
          <div className="bg-slate-950 text-white px-6 py-6 text-center border-b border-slate-800">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center font-black text-xl mx-auto mb-3 shadow-lg">
              CMS
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">
              ĐĂNG NHẬP QUẢN TRỊ 11SPORT (CMS)
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Dành riêng cho Quản lý / Admin (Quản lý Kho, Giá bán, Category & Nhân sự)
            </p>
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
                  placeholder="Nhập username quản trị (VD: admin)..."
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition"
            >
              <LogIn className="w-4 h-4" />
              {loginLoading ? "Đang xác thực..." : "Đăng nhập CMS"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header CMS */}
      <header className="bg-slate-900 text-white shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-lg">
              CMS
            </div>
            <div>
              <div className="font-extrabold text-base flex items-center gap-2">
                11SPORT ADMIN CMS
                <span className="text-[11px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                  Admin
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Quản trị Tồn kho Đầu kỳ/Cuối kỳ, Giá bán, Category, Đơn hàng & Nhân sự
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Quản trị viên:</span>
              <strong className="text-white">{adminUser.fullName}</strong>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold">
                {adminUser.role}
              </span>
            </div>

            <a
              href={process.env.NEXT_PUBLIC_WEB_URL || "https://11sport-it.vercel.app"}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 border border-slate-700 flex items-center gap-1"
            >
              Mở Web POS & Kho <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-red-600/90 hover:bg-red-600 text-xs font-bold text-white flex items-center gap-1.5 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Đăng xuất
            </button>
          </div>
        </div>

        {/* Navigation 4 Module chính của CMS */}
        <div className="bg-slate-800/90 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-1.5 overflow-x-auto py-1.5">
            <button
              type="button"
              onClick={() => setActiveModule("INVENTORY")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeModule === "INVENTORY"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <Boxes className="w-4 h-4" />
              1. Quản lý Kho, Giá bán & Sổ kho
            </button>

            <button
              type="button"
              onClick={() => setActiveModule("CATEGORIES")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeModule === "CATEGORIES"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              2. Quản lý Category (Danh mục)
            </button>

            <button
              type="button"
              onClick={() => setActiveModule("ORDERS")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeModule === "ORDERS"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              3. Quản lý Đơn hàng & Trả/Đổi
            </button>

            <button
              type="button"
              onClick={() => setActiveModule("STAFF")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeModule === "STAFF"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              4. Quản lý Nhân viên & Phân quyền
            </button>

            <button
              type="button"
              onClick={() => setActiveModule("ACTIVITY")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeModule === "ACTIVITY"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <Activity className="w-4 h-4" />
              5. Hoạt động NV (Bán hàng / Kiểm kho)
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 print:p-0">
        {activeModule === "INVENTORY" && <InventoryModule />}
        {activeModule === "CATEGORIES" && <CategoryModule />}
        {activeModule === "ORDERS" && (
          <OrdersReturnsModule onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
        )}
        {activeModule === "STAFF" && <StaffModule />}
        {activeModule === "ACTIVITY" && <StaffActivityModule />}
      </main>

      {/* Modal In Hóa Đơn PDF (K80 / A4) */}
      <InvoicePdfModal
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />
    </div>
  );
}
