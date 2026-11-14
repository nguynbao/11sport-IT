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
import ShiftHandoverModule from "@/components/ShiftHandoverModule";
import MarketingPushProductsModule from "@/components/MarketingPushProductsModule";
import AccountProfileModule from "@/components/AccountProfileModule";
import ServiceManagementModule from "@/components/ServiceManagementModule";
import MyAttendanceCalendar from "@/components/MyAttendanceCalendar";
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
  CalendarDays,
  ClipboardCheck,
  Rocket,
  Wrench,
} from "lucide-react";

type CmsModuleType =
  | "INVENTORY"
  | "REVENUE"
  | "CATEGORIES"
  | "ORDERS"
  | "SERVICES"
  | "STAFF"
  | "ACTIVITY"
  | "SHIFT_HANDOVERS"
  | "PROMOTIONS"
  | "DEBTS"
  | "HRM"
  | "MY_ATTENDANCE"
  | "PUSH_PRODUCTS"
  | "PROFILE";

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
      id: "SERVICES",
      label: "Quản lý Dịch vụ & Đơn Dịch vụ",
      desc: "Tạo loại dịch vụ (giá mặc định) & theo dõi đơn dịch vụ khách gửi / hẹn trả",
      icon: Wrench,
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
      id: "SHIFT_HANDOVERS",
      label: "Quản lý Phiếu Bàn Giao Ca",
      desc: "Theo dõi biên bản chốt két, kiểm hàng Tầng 1 theo ngày (Vợt + ...) & xác nhận Ca 1 - Ca 2",
      icon: ClipboardCheck,
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
  CEO: [
    "REVENUE",
    "PUSH_PRODUCTS",
    "INVENTORY",
    "CATEGORIES",
    "ORDERS",
    "SERVICES",
    "STAFF",
    "HRM",
    "SHIFT_HANDOVERS",
    "ACTIVITY",
    "PROMOTIONS",
    "DEBTS",
    "PROFILE",
  ],
  ADMIN: [
    "REVENUE",
    "INVENTORY",
    "CATEGORIES",
    "ORDERS",
    "SERVICES",
    "STAFF",
    "SHIFT_HANDOVERS",
    "ACTIVITY",
    "PROMOTIONS",
    "DEBTS",
    "PROFILE",
  ],
  ACCOUNTANT: [
    "REVENUE",
    "INVENTORY",
    "ORDERS",
    "SERVICES",
    "SHIFT_HANDOVERS",
    "DEBTS",
    "MY_ATTENDANCE",
    "PROFILE",
  ],
  HR: ["HRM", "MY_ATTENDANCE", "PROFILE"],
  MARKETING: ["PUSH_PRODUCTS", "MY_ATTENDANCE", "PROFILE"],
};

export default function CmsDashboardPage() {
  const [activeModule, setActiveModule] = useState<CmsModuleType>("REVENUE");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
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
      if (saved && token && token !== "demo-admin-token" && ["CEO", "ADMIN", "HR", "ACCOUNTANT", "MARKETING"].includes(saved.role)) {
        setAdminUser(saved);
        if (saved.role === "ACCOUNTANT") setActiveModule("REVENUE");
        else if (saved.role === "HR") setActiveModule("HRM");
        else if (saved.role === "MARKETING") setActiveModule("PUSH_PRODUCTS");
        else setActiveModule("REVENUE");
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
        const allowedRoles = ["CEO", "ADMIN", "HR", "ACCOUNTANT", "MARKETING"];
        if (!allowedRoles.includes(res.data.user.role)) {
          setLoginError(
            `Tài khoản "${res.data.user.username}" có vai trò ${res.data.user.role}. Chỉ Giám đốc (CEO), Quản lý (ADMIN), Nhân sự (HR), Kế toán (ACCOUNTANT) hoặc Marketing (MARKETING) mới được phép truy cập CMS!`
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
  const defaultMainModule: CmsModuleType =
    userAllowedModules.find((m) => m !== "PROFILE" && m !== "MY_ATTENDANCE") || "REVENUE";
  const visibleMenuItems = CMS_MENU_ITEMS.filter((item) => userAllowedModules.includes(item.id)).map(
    (item, idx) => {
      const isAccountantServices =
        adminUser?.role === "ACCOUNTANT" && item.id === "SERVICES";
      const label = isAccountantServices
        ? "Theo dõi Đơn Dịch vụ"
        : item.label;
      const desc = isAccountantServices
        ? "Tra cứu danh sách đơn dịch vụ, doanh thu dịch vụ & số tiền còn phải thu"
        : item.desc;
      return {
        ...item,
        label,
        desc,
        displayLabel: `${idx + 1}. ${label}`,
      };
    }
  );
  const effectiveModule: CmsModuleType = userAllowedModules.includes(activeModule)
    ? activeModule
    : defaultMainModule;

  const currentMenu =
    effectiveModule === "PROFILE"
      ? {
        id: "PROFILE" as CmsModuleType,
        label: "Thông tin tài khoản cá nhân",
        desc: "Xem hồ sơ nhân sự, hợp đồng, chế độ lương & đổi mật khẩu",
        icon: User,
        displayLabel: "Thông tin tài khoản cá nhân",
      }
      : effectiveModule === "MY_ATTENDANCE"
        ? {
          id: "MY_ATTENDANCE" as CmsModuleType,
          label: "Lịch Chấm Công Cá Nhân & Đơn Từ",
          desc: "Xem lại lịch chấm công tháng của bản thân, gửi đơn xin nghỉ / đi muộn / WFH",
          icon: CalendarDays,
          displayLabel: "Chấm công & Lịch công tháng",
        }
        : visibleMenuItems.find((item) => item.id === effectiveModule) ||
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
            <HeaderAttendanceBar
              currentUser={adminUser}
              onOpenMyAttendance={() => setActiveModule("MY_ATTENDANCE")}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRightDrawerOpen(true)}
              title="Mở Menu Cá Nhân (Chấm công & Thông tin tài khoản)"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition cursor-pointer ${effectiveModule === "PROFILE" || effectiveModule === "MY_ATTENDANCE"
                  ? "bg-emerald-600/25 border-emerald-500 text-white"
                  : "bg-slate-800 hover:bg-slate-700 border-slate-700"
                }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300 hidden md:inline">Nhân sự:</span>
              <strong className="text-white">{adminUser.fullName}</strong>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold">
                {adminUser.role}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsRightDrawerOpen(true)}
              title="Mở Menu Cá Nhân (Chấm công & Thông tin cá nhân)"
              aria-label="Mở Menu Cá Nhân"
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Menu className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>
        </div>
      </header>

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

          {/* Nội dung Drawer trượt từ bên phải */}
          <aside className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-slate-900 text-white shadow-2xl border-l border-slate-800 flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Header của Drawer */}
            <div className="px-4 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/logo-11sport-white.svg"
                  alt="11Sport Logo"
                  className="h-9 w-auto object-contain shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-extrabold text-sm tracking-tight truncate">
                    MENU CÁ NHÂN
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    11Sport Quản trị CMS
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRightDrawerOpen(false)}
                title="Đóng menu"
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thông tin nhân sự đang đăng nhập */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/60">
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-400">Đang đăng nhập:</div>
                  <div className="font-bold text-sm text-white truncate">
                    {adminUser.fullName}
                  </div>
                  {adminUser.username && (
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      @{adminUser.username}
                    </div>
                  )}
                  <div className="mt-1.5 inline-block font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">
                    {adminUser.role}
                  </div>
                </div>
              </div>
            </div>

            {/* Danh sách tiện ích cá nhân: Chấm công & Thông tin tài khoản */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="space-y-1.5">
                <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Tiện ích nhân sự
                </div>

                {/* 1. Chấm công: Lịch công tháng của tôi */}
                {userAllowedModules.includes("MY_ATTENDANCE") && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule("MY_ATTENDANCE");
                      setIsRightDrawerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2.5 transition ${effectiveModule === "MY_ATTENDANCE"
                        ? "bg-emerald-600 text-white shadow-md"
                        : "text-slate-200 hover:bg-slate-800 hover:text-white"
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${effectiveModule === "MY_ATTENDANCE"
                            ? "bg-white/20 text-white"
                            : "bg-amber-500/15 text-amber-400"
                          }`}
                      >
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate">Chấm công</div>
                        <div
                          className={`text-[10px] font-normal truncate mt-0.5 ${effectiveModule === "MY_ATTENDANCE"
                              ? "text-emerald-100"
                              : "text-slate-400"
                            }`}
                        >
                          Lịch công tháng, đơn từ &amp; tăng ca
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 ${effectiveModule === "MY_ATTENDANCE"
                          ? "text-white"
                          : "text-slate-500"
                        }`}
                    />
                  </button>
                )}

                {/* 2. Thông tin tài khoản cá nhân */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveModule("PROFILE");
                    setIsRightDrawerOpen(false);
                  }}
                  className={`w-full text-left px-3 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2.5 transition ${effectiveModule === "PROFILE"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "text-slate-200 hover:bg-slate-800 hover:text-white"
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${effectiveModule === "PROFILE"
                          ? "bg-white/20 text-white"
                          : "bg-emerald-500/15 text-emerald-400"
                        }`}
                    >
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate">Thông tin tài khoản</div>
                      <div
                        className={`text-[10px] font-normal truncate mt-0.5 ${effectiveModule === "PROFILE"
                            ? "text-emerald-100"
                            : "text-slate-400"
                          }`}
                      >
                        Xem hồ sơ &amp; chỉnh sửa thông tin cá nhân
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${effectiveModule === "PROFILE"
                        ? "text-white"
                        : "text-slate-500"
                      }`}
                  />
                </button>

                {/* 3. Đổi mật khẩu */}
                <button
                  type="button"
                  onClick={() => {
                    setIsRightDrawerOpen(false);
                    handleOpenChangePwd();
                  }}
                  className="w-full text-left px-3 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2.5 text-slate-200 hover:bg-slate-800 hover:text-white transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate">Đổi mật khẩu</div>
                      <div className="text-[10px] font-normal truncate mt-0.5 text-slate-400">
                        Cập nhật mật khẩu đăng nhập CMS
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Footer của Drawer phải: Nút Đăng xuất */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80">
              <button
                type="button"
                onClick={() => {
                  setIsRightDrawerOpen(false);
                  handleLogout();
                }}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất tài khoản</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* DRAWER MENU TRƯỢT TỪ BÊN TRÁI */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex print:hidden">
          {/* Lớp nền mờ */}
          <div
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Nội dung Drawer */}
          <aside className="relative z-10 w-85 max-w-[88vw] bg-slate-900 text-white h-full shadow-2xl border-r border-slate-800 flex flex-col overflow-y-auto">
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
        {effectiveModule === "SERVICES" && (
          <ServiceManagementModule currentUser={adminUser} />
        )}
        {effectiveModule === "STAFF" && (
          <StaffModule
            mode={adminUser.role === "CEO" ? "HR_FULL" : "ADMIN_LOCK_ONLY"}
            currentUser={adminUser}
          />
        )}
        {effectiveModule === "HRM" && <HrmAttendanceModule currentUser={adminUser} />}
        {effectiveModule === "MY_ATTENDANCE" && (
          <MyAttendanceCalendar
            currentUser={adminUser}
            onBack={() => setActiveModule(defaultMainModule)}
          />
        )}
        {effectiveModule === "SHIFT_HANDOVERS" && (
          <ShiftHandoverModule currentUser={adminUser} />
        )}
        {effectiveModule === "ACTIVITY" && <StaffActivityModule />}
        {effectiveModule === "PROMOTIONS" && <PromotionModule />}
        {effectiveModule === "DEBTS" && (
          <DebtManagementModule onOpenInvoice={(ord) => setInvoiceOrder(ord)} />
        )}
        {effectiveModule === "PUSH_PRODUCTS" && <MarketingPushProductsModule />}
        {effectiveModule === "PROFILE" && (
          <AccountProfileModule
            currentUser={adminUser}
            onUserUpdated={(updated) => setAdminUser(updated)}
            onBack={() => setActiveModule(defaultMainModule)}
          />
        )}
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
