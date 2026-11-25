"use client";

import { useEffect, useState } from "react";
import { CalendarDays, User } from "lucide-react";
import { CMS_MENU_ITEMS } from "@/config/menu";
import { CmsModuleType, ROLE_ALLOWED_MODULES } from "@/config/roles";
import {
  apiRequest,
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  setStoredAuth,
} from "@/shared/api/client";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { Order, StaffUser } from "@/shared/types";

export function useCmsShell() {
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
  const [showIpConfigModal, setShowIpConfigModal] = useState(false);
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


  const userAllowedModules = adminUser?.role ? (ROLE_ALLOWED_MODULES[adminUser.role] || ["HRM"]) : [];
  const defaultMainModule: CmsModuleType =
    userAllowedModules.find((m) => m !== "PROFILE" && m !== "MY_ATTENDANCE") || "REVENUE";
  const visibleMenuItems = CMS_MENU_ITEMS.filter((item) => userAllowedModules.includes(item.id)).map(
    (item, idx) => {
      const isAccountantServices =
        adminUser?.role === "ACCOUNTANT" && item.id === "SERVICES";
      const label = isAccountantServices
        ? "Đơn Dịch vụ"
        : item.label;
      const desc = isAccountantServices
        ? "Tra cứu danh sách đơn dịch vụ, doanh thu dịch vụ & số tiền còn phải thu"
        : item.desc;
      return {
        ...item,
        label,
        desc,
        displayLabel: label,
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
        visibleMenuItems[0] || { ...CMS_MENU_ITEMS[0], displayLabel: CMS_MENU_ITEMS[0].label };
  const CurrentIcon = currentMenu.icon;


  return {
    activeModule,
    setActiveModule,
    isDrawerOpen,
    setIsDrawerOpen,
    isRightDrawerOpen,
    setIsRightDrawerOpen,
    adminUser,
    setAdminUser,
    checkingAuth,
    invoiceOrder,
    setInvoiceOrder,
    username,
    setUsername,
    password,
    setPassword,
    loginLoading,
    loginError,
    showChangePwdModal,
    setShowChangePwdModal,
    showIpConfigModal,
    setShowIpConfigModal,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    pwdLoading,
    pwdMessage,
    setPwdMessage,
    handleLoginSubmit,
    handleLogout,
    handleOpenChangePwd,
    handleChangePasswordSubmit,
    userAllowedModules,
    defaultMainModule,
    visibleMenuItems,
    effectiveModule,
    currentMenu,
    CurrentIcon,
  };
}
