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
import DebtManagementModule from "@/components/DebtManagementModule";
import HrmAttendanceModule from "@/components/HrmAttendanceModule";
import MarketingPushProductsModule from "@/components/MarketingPushProductsModule";
import HeaderAttendanceBar from "@/components/HeaderAttendanceBar";
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
  Wallet,
  Menu,
  ChevronRight,
  X,
  CalendarCheck,
  Rocket,
} from "lucide-react";

type CmsModuleType =
  | "INVENTORY"
  | "REVENUE"
  | "CATEGORIES"
  | "ORDERS"
  | "STAFF"
  | "ACTIVITY"
  | "PROMOTIONS"
  | "DEBTS"
  | "HRM"
  | "PUSH_PRODUCTS";

const CMS_MENU_ITEMS: {
  id: CmsModuleType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "amber" | "emerald";
}[] = [
    {
      id: "REVENUE",
      label: "Dashboard Doanh thu & SP Bán chạy",
      desc: "Thống kê doanh thu, lãi gộp, xu hướng & tổng quan công nợ",
      icon: TrendingUp,
    },
    {
      id: "PUSH_PRODUCTS",
      label: "Các Sản Phẩm Đang Cần Đẩy Mạnh",
      desc: "Quan sát các mặt hàng tồn kho cao, bán chậm, đọng vốn hoặc nằm ở Kho Tầng 2",
      icon: Rocket,
    },
    {
      id: "INVENTORY",
      label: "Quản lý Kho, Giá bán & Sổ kho",
      desc: "Tồn kho Tầng 1 & Tầng 2, phiếu nhập/xuất, điều chỉnh giá",
      icon: Boxes,
    },
    {
      id: "CATEGORIES",
      label: "Quản lý Category (Danh mục)",
      desc: "Phân loại nhóm sản phẩm cầu lông & phụ kiện 11Sport",
      icon: FolderKanban,
    },
    {
      id: "ORDERS",
      label: "Quản lý Đơn hàng & Trả/Đổi",
      desc: "Tra cứu hóa đơn POS, bản nháp, lịch sử trả/đổi & in PDF",
      icon: ShoppingBag,
    },
    {
      id: "STAFF",
      label: "Quản lý Nhân sự & Khóa Tài khoản",
      desc: "Danh sách nhân viên và khóa / mở khóa tài khoản",
      icon: Users,
    },
    {
      id: "HRM",
      label: "Chấm công, Xếp ca & Lịch lễ (HRM)",
      desc: "Duyệt WFH, kéo-thả xếp ca tuần, quản lý ngày lễ & tạo tài khoản NV",
      icon: CalendarCheck,
    },
    {
      id: "ACTIVITY",
      label: "Hoạt động NV (Bán hàng / Kiểm kho)",
      desc: "Nhật ký hiệu suất bán hàng & kiểm đếm kho theo nhân sự",
      icon: Activity,
    },
    {
      id: "PROMOTIONS",
      label: "Chương trình Khuyến mãi",
      desc: "Cấu hình giảm giá %, giảm tiền & quà tặng kèm tự động",
      icon: Gift,
    },
    {
      id: "DEBTS",
      label: "Quản lý Công nợ & Thu nợ",
      desc: "Theo dõi khách mua trước trả sau, cảnh báo quá hạn & tất toán",
      icon: Wallet,
    },
  ];

const ROLE_ALLOWED_MODULES: Record<string, CmsModuleType[]> = {
  ADMIN: ["REVENUE", "INVENTORY", "CATEGORIES", "ORDERS", "STAFF", "ACTIVITY", "PROMOTIONS", "DEBTS"],
  ACCOUNTANT: ["REVENUE", "INVENTORY", "CATEGORIES", "ORDERS", "DEBTS"],
  HR: ["HRM"],
  MARKETING: ["PUSH_PRODUCTS"],
};

export default function CmsDashboardPage() {
  const [activeModule, setActiveModule] = useState<CmsModuleType>("REVENUE");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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
      if (saved && token && token !== "demo-admin-token" && ["ADMIN", "HR", "ACCOUNTANT", "MARKETING"].includes(saved.role)) {
        setAdminUser(saved);
        if (saved.role === "ACCOUNTANT") setActiveModule("REVENUE");
        else if (saved.role === "HR") setActiveModule("HRM");
        else if (saved.role === "MARKETING") setActiveModule("PUSH_PRODUCTS");
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
    apiRequest("/health").catch(() => { });
    const timer = setInterval(() => {
      apiRequest("/health").catch(() => { });
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
        const allowedRoles = ["ADMIN", "HR", "ACCOUNTANT", "MARKETING"];
        if (!allowedRoles.includes(res.data.user.role)) {
          setLoginError(
            `Tài khoản "${res.data.user.username}" có vai trò ${res.data.user.role}. Chỉ Quản lý (ADMIN), Nhân sự (HR), Kế toán (ACCOUNTANT) hoặc Marketing (MARKETING) mới được phép truy cập CMS!`
          );
          return;
        }
        setStoredAuth(res.data.token, res.data.user);
        setAdminUser(res.data.user);
        if (res.data.user.role === "ACCOUNTANT") setActiveModule("REVENUE");
        else if (res.data.user.role === "HR") setActiveModule("HRM");
        else if (res.data.user.role === "MARKETING") setActiveModule("PUSH_PRODUCTS");
        else setActiveModule("REVENUE");
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

  const userAllowedModules = adminUser?.role ? (ROLE_ALLOWED_MODULES[adminUser.role] || ["HRM"]) : [];
  const visibleMenuItems = CMS_MENU_ITEMS.filter((item) => userAllowedModules.includes(item.id)).map(
    (item, idx) => ({
      ...item,
      displayLabel: `${idx + 1}. ${item.label}`,
    })
  );
  const effectiveModule: CmsModuleType = userAllowedModules.includes(activeModule)
    ? activeModule
    : (userAllowedModules[0] || "REVENUE");

  const currentMenu =
    visibleMenuItems.find((item) => item.id === effectiveModule) ||
    visibleMenuItems[0] || { ...CMS_MENU_ITEMS[0], displayLabel: `1. ${CMS_MENU_ITEMS[0].label}` };
  const CurrentIcon = currentMenu.icon;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header CMS tích hợp nút mở Drawer Menu */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-lg print:hidden border-b border-slate-800">
        <div className="max-w-[98vw] 2xl:max-w-[1880px] mx-auto px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Nút mở Drawer Menu */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
              title="Mở danh mục quản trị CMS (Drawer Menu)"
            >
              <Menu className="w-4 h-4" />
              <span>Menu CMS</span>
            </button>

            <img
              src="/logo-11sport-white.svg"
              alt="11Sport Logo"
              className="h-9 md:h-10 w-auto object-contain shrink-0 hidden sm:block"
            />

            <div className="border-l border-slate-700 pl-3">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight">
                  11SPORT CMS
                </span>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                  {adminUser.role}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 transition"
              >
                <CurrentIcon className="w-3.5 h-3.5" />
                <span>Đang mở: {currentMenu.displayLabel}</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-75" />
              </button>
            </div>
          </div>

          {/* Thanh Chấm công trực tiếp nằm ở giữa Header CMS (Play / Pause & Đồng hồ giờ làm) */}
          <div className="flex-1 flex items-center justify-center px-2">
            <HeaderAttendanceBar currentUser={adminUser} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300 hidden md:inline">Tài khoản:</span>
              <strong className="text-white">{adminUser.fullName}</strong>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold">
                {adminUser.role}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* DRAWER MENU TRƯỢT TỪ BÊN TRÁI */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex print:hidden">
          {/* Lớp nền mờ */}
          <div
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Nội dung Drawer */}
          <aside className="relative z-10 w-85 max-w-[88vw] bg-slate-900 text-white h-full shadow-2xl border-r border-slate-800 flex flex-col justify-between overflow-y-auto">
            <div>
              {/* Đầu Drawer */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/logo-11sport-white.svg"
                    alt="11Sport Logo"
                    className="h-9 w-auto object-contain"
                  />
                  <div>
                    <div className="font-extrabold text-sm tracking-tight text-white">
                      MENU QUẢN TRỊ CMS
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Chọn phân hệ làm việc
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Đóng menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Danh sách Module trong Drawer theo quyền */}
              <nav className="p-3 space-y-1.5">
                {visibleMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = effectiveModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveModule(item.id);
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-3 ${isActive
                        ? "bg-emerald-600 text-white border-emerald-500 shadow-lg"
                        : "bg-slate-800/40 hover:bg-slate-800 text-slate-200 border-slate-800"
                        }`}
                    >
                      <div
                        className={`p-2 rounded-lg shrink-0 mt-0.5 ${isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-800 text-emerald-400"
                          }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-extrabold leading-snug">
                          {item.displayLabel}
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 line-clamp-2 ${isActive ? "text-white/85" : "text-slate-400"
                            }`}
                        >
                          {item.desc}
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 self-center ${isActive ? "text-white" : "text-slate-500"
                          }`}
                      />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Chân Drawer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Đang đăng nhập:</span>
                <strong className="text-white">
                  {adminUser.fullName} ({adminUser.role})
                </strong>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    handleOpenChangePwd();
                  }}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold flex items-center justify-center gap-1.5 border border-slate-700"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Đổi mật khẩu
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-2 px-3 rounded-xl bg-red-600/90 hover:bg-red-600 text-white font-bold flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Đăng xuất
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content (Nới rộng tối đa không gian hiển thị 2 bên) */}
      <main className="flex-1 max-w-[98vw] 2xl:max-w-[1880px] w-full mx-auto px-3 sm:px-5 py-5 print:p-0">
        {effectiveModule === "INVENTORY" && <InventoryModule />}
        {effectiveModule === "REVENUE" && (
          <RevenueDashboardModule
            onNavigateToInventory={() => setActiveModule("INVENTORY")}
          />
        )}
        {effectiveModule === "CATEGORIES" && <CategoryModule />}
        {effectiveModule === "ORDERS" && (
          <OrdersReturnsModule onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
        )}
        {effectiveModule === "STAFF" && <StaffModule mode="ADMIN_LOCK_ONLY" />}
        {effectiveModule === "HRM" && <HrmAttendanceModule currentUser={adminUser} />}
        {effectiveModule === "ACTIVITY" && <StaffActivityModule />}
        {effectiveModule === "PROMOTIONS" && <PromotionModule />}
        {effectiveModule === "DEBTS" && (
          <DebtManagementModule onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
        )}
        {effectiveModule === "PUSH_PRODUCTS" && <MarketingPushProductsModule />}
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
                  className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${pwdMessage.type === "success"
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
