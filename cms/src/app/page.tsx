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
import RevenueDashboardModule from "@/components/RevenueDashboardModule";
import CategoryModule from "@/components/CategoryModule";
import OrdersReturnsModule from "@/components/OrdersReturnsModule";
import StaffModule from "@/components/StaffModule";
import StaffActivityModule from "@/components/StaffActivityModule";
import PromotionModule from "@/components/PromotionModule";
import InvoicePdfModal from "@/components/InvoicePdfModal";
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
  X,
} from "lucide-react";

type CmsModuleType =
  | "INVENTORY"
  | "REVENUE"
  | "CATEGORIES"
  | "ORDERS"
  | "STAFF"
  | "ACTIVITY"
  | "PROMOTIONS";

export default function CmsDashboardPage() {
  const [activeModule, setActiveModule] = useState<CmsModuleType>("REVENUE");
  const [adminUser, setAdminUser] = useState<StaffUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  // State form Login CMS
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // State Modal Đổi mật khẩu trong CMS
  const [showChangePwdModal, setShowChangePwdModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    try {
      const saved = getStoredUser();
      const token = getStoredToken();
      if (saved && token && token !== "demo-admin-token" && saved.role === "ADMIN") {
        setAdminUser(saved);
      } else {
        clearStoredAuth();
      }
    } catch {
      clearStoredAuth();
    } finally {
      setCheckingAuth(false);
    }
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

  const handleOpenChangePwd = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPwdMessage(null);
    setShowChangePwdModal(true);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMessage(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPwdMessage({
        type: "error",
        text: "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.",
      });
      return;
    }

    const cleanNew = newPassword.trim();
    if (cleanNew.length < 4) {
      setPwdMessage({
        type: "error",
        text: "Mật khẩu mới phải có ít nhất 4 ký tự.",
      });
      return;
    }

    if (cleanNew !== confirmNewPassword.trim()) {
      setPwdMessage({
        type: "error",
        text: "Xác nhận mật khẩu mới không khớp.",
      });
      return;
    }

    setPwdLoading(true);
    try {
      try {
        await apiRequest("/auth/change-password", {
          method: "POST",
          body: JSON.stringify({
            currentPassword,
            newPassword: cleanNew,
            username: adminUser?.username,
          }),
        });
      } catch (err: any) {
        // Nếu server cũ chưa có /auth/change-password thì xác thực bằng /auth/login rồi PATCH /staff/:id
        if (err?.code === " INVALID_CURRENT_PASSWORD" || err?.code === "INVALID_CURRENT_PASSWORD") {
          throw err;
        }
        if (adminUser?.username && adminUser?._id) {
          await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({
              username: adminUser.username,
              password: currentPassword,
            }),
          });
          await apiRequest(`/staff/${adminUser._id}`, {
            method: "PATCH",
            body: JSON.stringify({ password: cleanNew }),
          });
        } else {
          throw err;
        }
      }

      setPwdMessage({
        type: "success",
        text: "Đã đổi mật khẩu tài khoản Quản trị thành công!",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      setPwdMessage({
        type: "error",
        text: err?.message || "Mật khẩu hiện tại không đúng hoặc không thể đổi mật khẩu.",
      });
    } finally {
      setPwdLoading(false);
    }
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
            <img
              src="/logo-11sport-white.svg"
              alt="11Sport Logo"
              className="h-16 w-auto object-contain mx-auto mb-3"
            />
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
        <div className="max-w-[98vw] 2xl:max-w-[1880px] mx-auto px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/logo-11sport-white.svg"
              alt="11Sport Logo"
              className="h-10 md:h-11 w-auto object-contain shrink-0"
            />
            <div>
              <div className="font-extrabold text-base flex items-center gap-2">
                11SPORT ADMIN CMS
                <span className="text-[11px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                  Admin
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Quản trị Tồn kho, Doanh thu chi tiết, Giá bán, Category, Đơn hàng & Nhân sự
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Quản trị viên:</span>
              <strong className="text-white">{adminUser.fullName}</strong>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold">
                {adminUser.role}
              </span>
            </div>

            <button
              type="button"
              onClick={handleOpenChangePwd}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 border border-slate-700 flex items-center gap-1.5 transition"
              title="Đổi mật khẩu tài khoản Quản trị"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Đổi mật khẩu
            </button>

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

        {/* Navigation các Module chính của CMS */}
        <div className="bg-slate-800/90 border-t border-slate-800">
          <div className="max-w-[98vw] 2xl:max-w-[1880px] mx-auto px-3 sm:px-5 flex items-center gap-1.5 overflow-x-auto py-1.5">
            <button
              type="button"
              onClick={() => setActiveModule("REVENUE")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeModule === "REVENUE"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              1. Dashboard Doanh thu & SP Bán chạy / Cần đẩy
            </button>

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
              2. Quản lý Kho, Giá bán & Sổ kho
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
              3. Quản lý Category (Danh mục)
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
              4. Quản lý Đơn hàng & Trả/Đổi
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
              5. Quản lý Nhân viên & Phân quyền
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
              6. Hoạt động NV (Bán hàng / Kiểm kho)
            </button>

            <button
              type="button"
              onClick={() => setActiveModule("PROMOTIONS")}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition ${
                activeModule === "PROMOTIONS"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <Gift className="w-4 h-4" />
              7. Chương trình Khuyến mãi
            </button>
          </div>
        </div>
      </header>

      {/* Main Content (Nới rộng tối đa không gian hiển thị 2 bên) */}
      <main className="flex-1 max-w-[98vw] 2xl:max-w-[1880px] w-full mx-auto px-3 sm:px-5 py-5 print:p-0">
        {activeModule === "INVENTORY" && <InventoryModule />}
        {activeModule === "REVENUE" && (
          <RevenueDashboardModule
            onNavigateToInventory={() => setActiveModule("INVENTORY")}
          />
        )}
        {activeModule === "CATEGORIES" && <CategoryModule />}
        {activeModule === "ORDERS" && (
          <OrdersReturnsModule onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
        )}
        {activeModule === "STAFF" && <StaffModule />}
        {activeModule === "ACTIVITY" && <StaffActivityModule />}
        {activeModule === "PROMOTIONS" && <PromotionModule />}
      </main>

      {/* Modal Đổi mật khẩu Quản trị viên (Header CMS) */}
      {showChangePwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4 print:hidden">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="font-extrabold text-sm">
                  Đổi mật khẩu Quản trị viên ({adminUser.username})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePwdModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="p-5 space-y-4">
              {pwdMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                    pwdMessage.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
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
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow"
                >
                  {pwdLoading ? "Đang cập nhật..." : "Cập nhật Mật khẩu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal In Hóa Đơn PDF (K80 / A4) */}
      <InvoicePdfModal
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />
    </div>
  );
}
