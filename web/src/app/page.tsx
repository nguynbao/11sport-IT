"use client";

import React, { useState, useEffect } from "react";
import {
  StaffUser,
  UserRole,
  Order,
  apiRequest,
  getStoredUser,
  getStoredToken,
  setStoredAuth,
  clearStoredAuth,
} from "@/lib/api";
import PosTab from "@/components/PosTab";
import InventoryTab from "@/components/InventoryTab";
import ImportTab from "@/components/ImportTab";
import CustomerTab from "@/components/CustomerTab";
import ReturnExchangeTab from "@/components/ReturnExchangeTab";
import InvoicePdfModal from "@/components/InvoicePdfModal";
import AccountProfileTab from "@/components/AccountProfileTab";
import DrawerMenu, {
  TabType,
  TabConfig,
  DrawerPageType,
} from "@/components/DrawerMenu";
import {
  ShoppingCart,
  Package,
  ClipboardCheck,
  Users,
  RotateCcw,
  ShieldCheck,
  Menu,
  Lock,
  LogIn,
  User,
  KeyRound,
  AlertCircle,
  Clock,
  ArrowLeft,
} from "lucide-react";

const TABS_CONFIG: TabConfig[] = [
  {
    id: "POS",
    label: "1. Bán hàng (POS)",
    icon: ShoppingCart,
    allowedRoles: ["SALES", "ADMIN"],
    roleHint: "NV Bán hàng / Quản lý",
  },
  {
    id: "INVENTORY",
    label: "2. Kho hàng (Tồn kho)",
    icon: Package,
    allowedRoles: ["SALES", "WAREHOUSE", "ADMIN"],
    roleHint: "Tất cả nhân sự",
  },
  {
    id: "IMPORT",
    label: "3. Nhập kho (7 Bước & Camera OCR)",
    icon: ClipboardCheck,
    allowedRoles: ["WAREHOUSE", "ADMIN"],
    roleHint: "Thủ kho / Quản lý",
  },
  {
    id: "CUSTOMER",
    label: "4. Tra cứu Khách & Xuất PDF",
    icon: Users,
    allowedRoles: ["SALES", "ADMIN"],
    roleHint: "NV Bán hàng / Quản lý",
  },
  {
    id: "RETURN",
    label: "5. Trả / Đổi hàng",
    icon: RotateCcw,
    allowedRoles: ["SALES", "ADMIN"],
    roleHint: "NV Bán hàng / Quản lý",
  },
];

function getDefaultTabForRole(role: UserRole): TabType {
  if (role === "WAREHOUSE") return "IMPORT";
  return "POS";
}

function getRoleDisplayName(role?: UserRole): string {
  if (role === "ADMIN") return "Quản lý (ADMIN)";
  if (role === "WAREHOUSE") return "Thủ kho (WAREHOUSE)";
  return "NV Bán hàng (SALES)";
}

export default function WebPosHomePage() {
  const [activeTab, setActiveTab] = useState<TabType>("POS");
  const [activeDrawerPage, setActiveDrawerPage] =
    useState<DrawerPageType>("NONE");
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // State form Login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const savedUser = getStoredUser();
    const savedToken = getStoredToken();
    if (savedUser && savedToken && savedToken !== "demo-token") {
      setCurrentUser(savedUser);
      setActiveTab(getDefaultTabForRole(savedUser.role));
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
      setLoginError("Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.");
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
        setStoredAuth(res.data.token, res.data.user);
        setCurrentUser(res.data.user);
        setActiveTab(getDefaultTabForRole(res.data.user.role));
        setPassword("");
      }
    } catch (err: any) {
      setLoginError(
        err?.message || "Sai tên đăng nhập hoặc mật khẩu, hoặc tài khoản đã bị khóa."
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setDrawerOpen(false);
    setActiveDrawerPage("NONE");
    clearStoredAuth();
    setCurrentUser(null);
    setUsername("");
    setPassword("");
    setLoginError("");
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-sm font-semibold text-slate-300">
          Đang kiểm tra phiên đăng nhập...
        </div>
      </div>
    );
  }

  // Màn hình Đăng nhập khi chưa có phiên đăng nhập
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
          <div className="bg-slate-950 text-white px-6 py-6 text-center border-b border-slate-800">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center font-black text-2xl tracking-tighter mx-auto mb-3 shadow-lg">
              11S
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">
              ĐĂNG NHẬP 11SPORT POS & KHO
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Hệ thống Bán hàng tại quầy, Kiểm kho Camera & Quản lý Tồn kho
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="p-4 sm:p-6 space-y-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Tên đăng nhập (Username)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập username (VD: sales1, warehouse1, admin)..."
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
              {loginLoading ? "Đang xác thực..." : "Đăng nhập vào Hệ thống"}
            </button>

            <div className="pt-3 border-t border-slate-200 text-xs text-slate-500 space-y-1">
              <div className="font-bold text-slate-700">
                Phân quyền truy cập theo vai trò:
              </div>
              <div>
                • <strong>NV Bán hàng (SALES):</strong> Bán hàng POS, Tồn kho, Tra cứu Khách & PDF, Trả/Đổi hàng.
              </div>
              <div>
                • <strong>Thủ kho (WAREHOUSE):</strong> Tồn kho, Nhập kho (7 Bước & Camera OCR).
              </div>
              <div>
                • <strong>Quản lý (ADMIN):</strong> Mở toàn bộ 5 chức năng & Quản trị CMS.
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const currentTabConfig = TABS_CONFIG.find((t) => t.id === activeTab);
  const isCurrentTabAllowed =
    currentTabConfig?.allowedRoles.includes(currentUser.role) ?? false;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header thương hiệu 11Sport & Thông tin người dùng */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-2.5 md:py-3 flex items-center justify-between gap-2 md:gap-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="w-9 h-9 md:w-10 md:h-10 shrink-0 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-base md:text-lg tracking-tighter">
              11S
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm md:text-base tracking-tight flex items-center gap-2 truncate">
                <span className="truncate">11SPORT POS & KHO VẬN</span>
                <span className="hidden sm:inline text-[11px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                  v1.0
                </span>
              </div>
              <div className="hidden md:block text-xs text-slate-400">
                Hệ thống Bán hàng, Xuất PDF (K80/A4), Camera OCR Kiểm kho & Đổi trả
              </div>
              {/* Mobile: tên nhân sự rút gọn dưới tên thương hiệu */}
              <div className="md:hidden text-[11px] text-slate-400 truncate">
                {currentUser.fullName} ·{" "}
                <span className="text-emerald-400 font-bold">{currentUser.role}</span>
              </div>
            </div>
          </div>

          {/* Thông tin tài khoản đang đăng nhập & Đăng xuất */}
          <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
            <div className="hidden md:flex items-center gap-2 bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div className="text-xs">
                <span className="text-slate-400">Nhân sự: </span>
                <strong className="text-white">{currentUser.fullName}</strong>{" "}
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white font-bold ml-1">
                  {getRoleDisplayName(currentUser.role)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              title="Mở menu điều hướng"
              aria-label="Mở menu điều hướng"
              className="min-h-[40px] min-w-[40px] px-2.5 md:px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 flex items-center justify-center gap-1.5 transition"
            >
              <Menu className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>
        </div>

        {/* Thanh 5 Tab chức năng phân quyền theo Role (mobile: cuộn ngang) */}
        <div className="bg-slate-800/90 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-2 md:px-4 flex items-center gap-1 md:gap-1.5 overflow-x-auto no-scrollbar snap-x py-1.5">
            {TABS_CONFIG.map((tab) => {
              const Icon = tab.icon;
              const isAllowed = tab.allowedRoles.includes(currentUser.role);
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
                    if (isAllowed) {
                      setActiveDrawerPage("NONE");
                      setActiveTab(tab.id);
                    }
                  }}
                  className={`min-h-[40px] shrink-0 snap-start px-3 md:px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 md:gap-2 whitespace-nowrap transition ${
                    !isAllowed
                      ? "opacity-40 cursor-not-allowed text-slate-400 bg-slate-900/40"
                      : isActive
                      ? "bg-emerald-600 text-white shadow"
                      : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                  }`}
                >
                  {isAllowed ? (
                    <Icon className="w-4 h-4" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto px-3 py-3 md:px-4 md:py-6 print:p-0">
        {activeDrawerPage === "PROFILE" ? (
          <AccountProfileTab
            currentUser={currentUser}
            onUserUpdated={(updated) => setCurrentUser(updated)}
            onBack={() => setActiveDrawerPage("NONE")}
            getRoleDisplayName={getRoleDisplayName}
          />
        ) : activeDrawerPage === "ATTENDANCE" ? (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
              <Clock className="w-7 h-7 text-amber-500" />
            </div>
            <div className="space-y-1.5">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-700">
                Chưa triển khai (Coming Soon)
              </span>
              <h3 className="text-lg font-extrabold text-slate-900">
                Tính năng Chấm công ca làm việc
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Chức năng điểm danh, chấm công nhận ca / kết ca dành cho nhân sự{" "}
                <strong>11Sport</strong> đang trong quá trình phát triển và sẽ sớm
                được cập nhật.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveDrawerPage("NONE")}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại màn hình làm việc</span>
              </button>
            </div>
          </div>
        ) : !isCurrentTabAllowed ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
            <Lock className="w-10 h-10 text-amber-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">
              Bạn không có quyền truy cập chức năng này
            </h3>
            <p className="text-xs text-slate-500">
              Vai trò hiện tại của bạn là{" "}
              <strong>{getRoleDisplayName(currentUser.role)}</strong>. Vui lòng chọn
              các tab được cấp quyền trên thanh công cụ.
            </p>
          </div>
        ) : (
          <>
            {activeTab === "POS" && (
              <PosTab onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
            )}
            {activeTab === "INVENTORY" && <InventoryTab />}
            {activeTab === "IMPORT" && <ImportTab />}
            {activeTab === "CUSTOMER" && (
              <CustomerTab onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
            )}
            {activeTab === "RETURN" && <ReturnExchangeTab />}
          </>
        )}
      </main>

      {/* Drawer Menu (thay thế vị trí nút Đăng xuất trên Header) */}
      <DrawerMenu
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentUser={currentUser}
        activeDrawerPage={activeDrawerPage}
        onOpenProfile={() => setActiveDrawerPage("PROFILE")}
        onOpenAttendance={() => setActiveDrawerPage("ATTENDANCE")}
        onLogout={handleLogout}
        getRoleDisplayName={getRoleDisplayName}
        cmsUrl={
          process.env.NEXT_PUBLIC_CMS_URL ||
          "https://11sport-it-m1ei.vercel.app"
        }
      />

      {/* Modal Xuất / In Hóa Đơn PDF (K80 / A4) */}
      <InvoicePdfModal
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />
    </div>
  );
}
