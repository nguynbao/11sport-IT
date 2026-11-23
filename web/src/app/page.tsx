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
import PosServiceSection from "@/components/PosServiceSection";
import InventoryTab from "@/components/InventoryTab";
import CustomerTab from "@/components/CustomerTab";
import ReturnExchangeTab from "@/components/ReturnExchangeTab";
import PosShiftBillsSection from "@/components/PosShiftBillsSection";
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
  Users,
  RotateCcw,
  ShieldCheck,
  Menu,
  Lock,
  LogIn,
  User,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  X,
  Clock,
  ArrowLeft,
  Rocket,
  CalendarCheck,
  FileText,
  Wrench,
} from "lucide-react";

const TABS_CONFIG: TabConfig[] = [
  {
    id: "POS",
    label: "Bán hàng",
    icon: ShoppingCart,
    allowedRoles: ["SALES", "ADMIN", "CEO"],
    roleHint: "NV Bán hàng / Quản lý / Giám đốc",
  },
  {
    id: "SERVICES",
    label: "Làm dịch vụ",
    icon: Wrench,
    allowedRoles: ["SALES", "ADMIN", "CEO"],
    roleHint: "NV Bán hàng / Quản lý / Giám đốc",
  },
  {
    id: "INVENTORY",
    label: "Kho hàng",
    icon: Package,
    allowedRoles: ["SALES", "ADMIN", "CEO"],
    roleHint: "NV Bán hàng / Quản lý / Giám đốc",
  },
  {
    id: "CUSTOMER",
    label: "Khách hàng & PDF",
    icon: Users,
    allowedRoles: ["SALES", "ADMIN", "CEO"],
    roleHint: "NV Bán hàng / Quản lý / Giám đốc",
  },
  {
    id: "RETURN",
    label: "Đổi hàng",
    icon: RotateCcw,
    allowedRoles: ["SALES", "ADMIN", "CEO"],
    roleHint: "NV Bán hàng / Quản lý / Giám đốc",
  },
  {
    id: "INVOICE_HISTORY",
    label: "Lịch sử hoá đơn",
    icon: FileText,
    allowedRoles: ["SALES", "ADMIN", "CEO"],
    roleHint: "NV Bán hàng / Quản lý / Giám đốc",
  },
];

function getDefaultTabForRole(role: UserRole): TabType {
  if (role === "MARKETING") return "PUSH_PRODUCTS";
  return "POS";
}

function isBlockedFromWebPos(role?: UserRole): boolean {
  return role === "HR" || role === "ACCOUNTANT";
}

function isAttendanceOnlyRole(_role?: UserRole): boolean {
  return false;
}

function getRoleDisplayName(role?: UserRole): string {
  if (role === "CEO") return "Giám đốc (CEO)";
  if (role === "ADMIN") return "Quản lý (ADMIN)";
  if (role === "HR") return "Nhân sự (HR)";
  if (role === "ACCOUNTANT") return "Kế toán (ACCOUNTANT)";
  if (role === "MARKETING") return "Marketing (MARKETING)";
  return "NV Bán hàng (SALES)";
}

export default function WebPosHomePage() {
  const [activeTab, setActiveTab] = useState<TabType>("POS");
  const [activeDrawerPage, setActiveDrawerPage] =
    useState<DrawerPageType>("NONE");
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [hasUnseenShiftSchedule, setHasUnseenShiftSchedule] = useState(false);

  // State form Login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // State Modal Đổi mật khẩu
  const [showChangePwdModal, setShowChangePwdModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const savedUser = getStoredUser();
    const savedToken = getStoredToken();
    if (savedUser && savedToken && savedToken !== "demo-token" && !isBlockedFromWebPos(savedUser.role)) {
      setCurrentUser(savedUser);
      setActiveTab(getDefaultTabForRole(savedUser.role));
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
        if (isBlockedFromWebPos(res.data.user.role)) {
          setLoginError(
            `Tài khoản "${res.data.user.username}" có vai trò ${res.data.user.role}. Kế toán (ACCOUNTANT) và Nhân sự (HR) không truy cập Web POS — vui lòng đăng nhập và xem lịch chấm công trên trang Quản trị CMS!`
          );
          return;
        }
        setStoredAuth(res.data.token, res.data.user);
        setCurrentUser(res.data.user);
        setActiveDrawerPage("NONE");
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
    setLeftDrawerOpen(false);
    setRightDrawerOpen(false);
    setActiveDrawerPage("NONE");
    clearStoredAuth();
    setCurrentUser(null);
    setUsername("");
    setPassword("");
    setLoginError("");
  };

  const handleOpenChangePwd = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwdMessage(null);
    setShowChangePwdModal(true);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwdMessage({
        type: "error",
        text: "Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận.",
      });
      return;
    }

    if (newPassword.trim().length < 4) {
      setPwdMessage({
        type: "error",
        text: "Mật khẩu mới phải từ 4 ký tự trở lên.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdMessage({
        type: "error",
        text: "Mật khẩu xác nhận không khớp với mật khẩu mới.",
      });
      return;
    }

    setPwdSaving(true);
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword: newPassword.trim(),
          username: currentUser?.username,
        }),
      });
      setPwdMessage({
        type: "success",
        text: "Đã đổi mật khẩu thành công!",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwdMessage({
        type: "error",
        text: err?.message || "Không thể đổi mật khẩu. Vui lòng kiểm tra lại.",
      });
    } finally {
      setPwdSaving(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <div className="text-sm font-semibold text-slate-600">
          Đang kiểm tra phiên đăng nhập...
        </div>
      </div>
    );
  }

  // Màn hình Đăng nhập khi chưa có phiên đăng nhập
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/70 to-white px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-white text-slate-900 px-6 py-6 text-center border-b border-slate-100">
            <img
              src="/logo-11sport.svg"
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition"
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
      : currentUser.role === "CEO" || currentUser.role === "ADMIN"
        ? true
        : currentTabConfig?.allowedRoles.includes(currentUser.role) ?? false;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header thương hiệu 11Sport & Thông tin người dùng */}
      <header className="sticky top-0 z-30 bg-white text-slate-900 border-b border-slate-200 shadow-2xs print:hidden">
        <div className="w-full mx-auto px-2 sm:px-3 lg:px-4 py-2 md:py-2.5 flex items-center justify-between gap-2 md:gap-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {/* Nút mở Drawer Menu bên trái cho 5 Tab chức năng */}
            <button
              type="button"
              onClick={() => setLeftDrawerOpen(true)}
              title="Mở menu điều hướng 5 tab"
              aria-label="Mở menu điều hướng 5 tab"
              className="relative min-h-[40px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-extrabold text-white shadow-xs flex items-center justify-center gap-2 transition shrink-0 cursor-pointer"
            >
              <Menu className="w-4 h-4 text-white" />
              <span className="hidden sm:inline">
                {activeDrawerPage === "PROFILE"
                  ? "Tài khoản"
                  : activeDrawerPage === "ATTENDANCE"
                    ? "Chấm công"
                    : currentTabConfig?.label || "Menu"}
              </span>
            </button>

            <img
              src="/logo-11sport.svg"
              alt="11Sport Logo"
              className="h-8 md:h-10 w-auto object-contain shrink-0"
            />
            <div className="min-w-0 hidden sm:block">
              <div className="font-extrabold text-sm md:text-base tracking-tight text-slate-900 flex items-center gap-2 truncate">
                <span className="truncate">11SPORT POS & KHO VẬN</span>
                <span className="hidden lg:inline text-[11px] font-mono bg-blue-50 text-brand-ink border border-blue-200 px-2 py-0.5 rounded font-bold">
                  v2.0
                </span>
              </div>
            </div>
          </div>

          {/* Thanh Chấm công trực tiếp nằm ở giữa Header (Play / Pause & Đồng hồ giờ làm) */}
          <div className="flex-1 flex items-center justify-center px-1">
            <HeaderAttendanceBar currentUser={currentUser} />
          </div>

          {/* Thông tin tài khoản đang đăng nhập & Nút mở Tiện ích nhân sự bên phải */}
          <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setRightDrawerOpen(true)}
              title="Mở Tiện ích nhân sự & tài khoản"
              className={`hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl border transition cursor-pointer ${
                activeDrawerPage === "PROFILE" ||
                activeDrawerPage === "ATTENDANCE"
                  ? "bg-blue-50 border-blue-300 text-blue-900"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-brand-ink" />
              <div className="text-xs">
                <span className="text-slate-500">Nhân sự: </span>
                <strong className="text-slate-900">{currentUser.fullName}</strong>{" "}
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white font-bold ml-1">
                  {getRoleDisplayName(currentUser.role)}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRightDrawerOpen(true)}
              title="Tiện ích nhân sự"
              aria-label="Mở tiện ích nhân sự"
              className="relative min-h-[40px] min-w-[40px] px-2.5 md:px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs font-bold text-slate-800 border border-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <User className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-brand-ink" />
              <span className="hidden sm:inline">Tiện ích</span>
              {hasUnseenShiftSchedule && (
                <span
                  title="HR đã hoàn thành xếp ca tuần mới"
                  className="absolute -top-1 -right-1 flex h-3 w-3"
                >
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 border border-white" />
                </span>
              )}
            </button>
          </div>
        </div>
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
            {activeTab === "SERVICES" && <PosServiceSection />}
            {activeTab === "INVENTORY" && <InventoryTab />}
            {activeTab === "CUSTOMER" && (
              <CustomerTab onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
            )}
            {activeTab === "RETURN" && <ReturnExchangeTab />}
            {activeTab === "INVOICE_HISTORY" && (
              <PosShiftBillsSection onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
            )}
            {activeTab === "PUSH_PRODUCTS" && <MarketingPushProductsTab />}
          </>
        )}
      </main>

      {/* Drawer Menu BÊN TRÁI: Chuyên cho 5 Tab chức năng Bán hàng & Kho */}
      <DrawerMenu
        isOpen={leftDrawerOpen}
        onClose={() => setLeftDrawerOpen(false)}
        side="left"
        currentUser={currentUser}
        tabs={TABS_CONFIG}
        activeTab={activeTab}
        onSelectTab={(tabId) => {
          setActiveDrawerPage("NONE");
          setActiveTab(tabId);
        }}
        activeDrawerPage={activeDrawerPage}
        hasAttendanceNoti={hasUnseenShiftSchedule}
        onOpenProfile={() => setActiveDrawerPage("PROFILE")}
        onOpenAttendance={() => setActiveDrawerPage("ATTENDANCE")}
        onLogout={handleLogout}
        getRoleDisplayName={getRoleDisplayName}
      />

      {/* Drawer Menu BÊN PHẢI: Tiện ích nhân sự (Chấm công, Tài khoản, Đổi mật khẩu, CMS, Đăng xuất) */}
      <DrawerMenu
        isOpen={rightDrawerOpen}
        onClose={() => setRightDrawerOpen(false)}
        side="right"
        currentUser={currentUser}
        activeTab={activeTab}
        activeDrawerPage={activeDrawerPage}
        hasAttendanceNoti={hasUnseenShiftSchedule}
        onOpenProfile={() => setActiveDrawerPage("PROFILE")}
        onOpenAttendance={() => {
          setRightDrawerOpen(false);
          setActiveDrawerPage("ATTENDANCE");
        }}
        onOpenPushProducts={() => {
          setRightDrawerOpen(false);
          setActiveDrawerPage("NONE");
          setActiveTab("PUSH_PRODUCTS");
        }}
        onOpenChangePassword={handleOpenChangePwd}
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

      {/* Modal Đổi mật khẩu */}
      {showChangePwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4 print:hidden">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="font-extrabold text-sm">
                  Đổi mật khẩu tài khoản ({currentUser.username})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePwdModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-blue-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="p-5 space-y-4">
              {pwdMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                    pwdMessage.type === "success"
                      ? "bg-blue-50 border-blue-200 text-brand-ink"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mật khẩu mới *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 4 ký tự..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowChangePwdModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-extrabold"
                >
                  {pwdSaving ? "Đang lưu..." : "Lưu mật khẩu mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xuất / In Hóa Đơn PDF (K80) */}
      <InvoicePdfModal
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />

      {/* Nút Stash Tròn (Hình Máy Tính) mở Cửa sổ nhỏ Đổi tiền nhanh Wise */}
      <WiseCalculatorStash />
    </div>
  );
}
