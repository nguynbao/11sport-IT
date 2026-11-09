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
  fetchMyShiftScheduleApi,
} from "@/lib/api";
import PosTab from "@/components/PosTab";
import InventoryTab from "@/components/InventoryTab";
import ImportTab from "@/components/ImportTab";
import CustomerTab from "@/components/CustomerTab";
import ReturnExchangeTab from "@/components/ReturnExchangeTab";
import MarketingPushProductsTab from "@/components/MarketingPushProductsTab";
import InvoicePdfModal from "@/components/InvoicePdfModal";
import MyAttendanceCalendar from "@/components/MyAttendanceCalendar";
import AccountProfileTab from "@/components/AccountProfileTab";
import WiseCalculatorStash from "@/components/WiseCalculatorStash";
import HeaderAttendanceBar from "@/components/HeaderAttendanceBar";
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
  Rocket,
  CalendarCheck,
} from "lucide-react";

const TABS_CONFIG: TabConfig[] = [
  {
    id: "POS",
    label: "1. Bán hàng",
    icon: ShoppingCart,
    allowedRoles: ["SALES", "ADMIN"],
    roleHint: "NV Bán hàng / Quản lý",
  },
  {
    id: "INVENTORY",
    label: "2. Kho hàng",
    icon: Package,
    allowedRoles: ["SALES", "WAREHOUSE", "ADMIN"],
    roleHint: "Tất cả nhân sự",
  },
  {
    id: "IMPORT",
    label: "3. Nhập kho",
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
  if (role === "MARKETING") return "PUSH_PRODUCTS";
  return "POS";
}

function isAttendanceOnlyRole(role?: UserRole): boolean {
  return role === "HR" || role === "ACCOUNTANT";
}

function getRoleDisplayName(role?: UserRole): string {
  if (role === "ADMIN") return "Quản lý (ADMIN)";
  if (role === "HR") return "Nhân sự (HR)";
  if (role === "ACCOUNTANT") return "Kế toán (ACCOUNTANT)";
  if (role === "MARKETING") return "Marketing (MARKETING)";
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
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [hasUnseenShiftSchedule, setHasUnseenShiftSchedule] = useState(false);

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
      if (isAttendanceOnlyRole(savedUser.role)) {
        setActiveDrawerPage("ATTENDANCE");
      } else {
        setActiveTab(getDefaultTabForRole(savedUser.role));
      }
    } else {
      clearStoredAuth();
    }
    setCheckingAuth(false);
  }, []);

  // Định kỳ 8 phút gửi 1 API đánh thức server chống sleep (5-10 phút/lần)
  useEffect(() => {
    apiRequest("/health").catch(() => { });
    const timer = setInterval(() => {
      apiRequest("/health").catch(() => { });
    }, 8 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Kiểm tra thông báo chấm đỏ khi HR hoàn thành xếp ca cho nhân viên Bán hàng
  useEffect(() => {
    if (!currentUser || currentUser.role !== "SALES") {
      setHasUnseenShiftSchedule(false);
      return;
    }
    let active = true;
    const checkScheduleNoti = async () => {
      try {
        const sched = await fetchMyShiftScheduleApi();
        if (active) {
          setHasUnseenShiftSchedule(Boolean(sched.hasUnseenConfirmedSchedule));
        }
      } catch {
        // bỏ qua lỗi mạng tạm thời
      }
    };
    checkScheduleNoti();
    const timer = setInterval(checkScheduleNoti, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [currentUser]);

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
        if (isAttendanceOnlyRole(res.data.user.role)) {
          setActiveDrawerPage("ATTENDANCE");
        } else {
          setActiveDrawerPage("NONE");
          setActiveTab(getDefaultTabForRole(res.data.user.role));
        }
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
            <img
              src="/logo-11sport-white.svg"
              alt="11Sport Logo"
              className="h-16 w-auto object-contain mx-auto mb-3"
            />
            <h1 className="text-xl font-extrabold tracking-tight">
              ĐĂNG NHẬP 11SPORT POS & KHO
            </h1>
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
                  placeholder="Nhập username"
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
          </form>
        </div>
      </div>
    );
  }

  const currentTabConfig = TABS_CONFIG.find((t) => t.id === activeTab);
  const isCurrentTabAllowed =
    currentUser.role === "MARKETING"
      ? activeTab === "PUSH_PRODUCTS"
      : currentTabConfig?.allowedRoles.includes(currentUser.role) ?? false;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header thương hiệu 11Sport & Thông tin người dùng */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-lg print:hidden">
        <div className="w-full mx-auto px-2 sm:px-3 lg:px-4 py-2.5 md:py-3 flex items-center justify-between gap-2 md:gap-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <img
              src="/logo-11sport-white.svg"
              alt="11Sport Logo"
              className="h-9 md:h-11 w-auto object-contain shrink-0"
            />
            <div className="min-w-0">
              <div className="font-extrabold text-sm md:text-base tracking-tight flex items-center gap-2 truncate">
                <span className="truncate">11SPORT POS & KHO VẬN</span>
                <span className="hidden sm:inline text-[11px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                  v1.0
                </span>
              </div>
              {/* Mobile: tên nhân sự rút gọn dưới tên thương hiệu */}
              <div className="md:hidden text-[11px] text-slate-400 truncate">
                {currentUser.fullName} ·{" "}
                <span className="text-emerald-400 font-bold">{currentUser.role}</span>
              </div>
            </div>
          </div>

          {/* Thanh Chấm công trực tiếp nằm ở giữa Header (Play / Pause & Đồng hồ giờ làm) */}
          <div className="flex-1 flex items-center justify-center px-1">
            <HeaderAttendanceBar currentUser={currentUser} />
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
              className="relative min-h-[40px] min-w-[40px] px-2.5 md:px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 flex items-center justify-center gap-1.5 transition"
            >
              <Menu className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Menu</span>
              {hasUnseenShiftSchedule && (
                <span
                  title="HR đã hoàn thành xếp ca tuần mới"
                  className="absolute -top-1 -right-1 flex h-3 w-3"
                >
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 border border-slate-900" />
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Thanh Tab chức năng dành riêng cho Marketing: Các Sản Phẩm Đang Cần Đẩy Mạnh & Chấm công */}
        {currentUser.role === "MARKETING" ? (
          <div className="bg-slate-800/90 border-t border-slate-800">
            <div className="w-full mx-auto px-2 sm:px-3 lg:px-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar snap-x py-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveDrawerPage("NONE");
                  setActiveTab("PUSH_PRODUCTS");
                }}
                className={`min-h-[40px] shrink-0 snap-start px-3.5 md:px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                  activeDrawerPage === "NONE" && activeTab === "PUSH_PRODUCTS"
                    ? "bg-amber-400 text-slate-950 shadow"
                    : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                }`}
              >
                <Rocket className="w-4 h-4" />
                1. Các Sản Phẩm Đang Cần Đẩy Mạnh
              </button>
              <button
                type="button"
                onClick={() => setActiveDrawerPage("ATTENDANCE")}
                className={`min-h-[40px] shrink-0 snap-start px-3.5 md:px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                  activeDrawerPage === "ATTENDANCE"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                }`}
              >
                <CalendarCheck className="w-4 h-4" />
                2. Chấm công & Lịch công tháng
              </button>
            </div>
          </div>
        ) : (
          /* Thanh 5 Tab chức năng phân quyền theo Role (ẩn với tài khoản Khối văn phòng chỉ dùng Chấm công) */
          !isAttendanceOnlyRole(currentUser.role) && (
            <div className="bg-slate-800/90 border-t border-slate-800">
              <div className="w-full mx-auto px-2 sm:px-3 lg:px-4 flex items-center gap-1 md:gap-1.5 overflow-x-auto no-scrollbar snap-x py-1.5">
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
                      className={`min-h-[40px] shrink-0 snap-start px-3 md:px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 md:gap-2 whitespace-nowrap transition ${!isAllowed
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
          )
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full min-w-0 mx-auto px-2 py-2.5 sm:px-3 lg:px-4 md:py-4 print:p-0">
        {activeDrawerPage === "PROFILE" ? (
          <AccountProfileTab
            currentUser={currentUser}
            onUserUpdated={(updated) => setCurrentUser(updated)}
            onBack={() =>
              setActiveDrawerPage(
                isAttendanceOnlyRole(currentUser.role) ? "ATTENDANCE" : "NONE"
              )
            }
            getRoleDisplayName={getRoleDisplayName}
          />
        ) : activeDrawerPage === "ATTENDANCE" ||
          isAttendanceOnlyRole(currentUser.role) ? (
          <MyAttendanceCalendar
            currentUser={currentUser}
            onScheduleSeen={() => setHasUnseenShiftSchedule(false)}
            onBack={
              isAttendanceOnlyRole(currentUser.role)
                ? undefined
                : () => setActiveDrawerPage("NONE")
            }
          />
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
            {activeTab === "PUSH_PRODUCTS" && <MarketingPushProductsTab />}
          </>
        )}
      </main>

      {/* Drawer Menu (thay thế vị trí nút Đăng xuất trên Header) */}
      <DrawerMenu
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentUser={currentUser}
        activeDrawerPage={activeDrawerPage}
        hasAttendanceNoti={hasUnseenShiftSchedule}
        onOpenProfile={() => setActiveDrawerPage("PROFILE")}
        onOpenAttendance={() => {
          setDrawerOpen(false);
          setActiveDrawerPage("ATTENDANCE");
        }}
        onOpenPushProducts={() => {
          setDrawerOpen(false);
          setActiveDrawerPage("NONE");
          setActiveTab("PUSH_PRODUCTS");
        }}
        onLogout={handleLogout}
        getRoleDisplayName={getRoleDisplayName}
        cmsUrl={
          process.env.NEXT_PUBLIC_CMS_URL ||
          (typeof window !== "undefined" &&
            (window.location.hostname === "localhost" ||
              window.location.hostname === "127.0.0.1")
            ? "http://localhost:3001"
            : "https://11sport-it-m1ei.vercel.app")
        }
      />

      {/* Modal Xuất / In Hóa Đơn PDF (K80 / A4) */}
      <InvoicePdfModal
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />

      {/* Nút Stash Tròn (Hình Máy Tính) mở Cửa sổ nhỏ Đổi tiền nhanh Wise */}
      <WiseCalculatorStash />
    </div>
  );
}
