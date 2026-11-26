import { useEffect, useState } from "react";
import type { Order, StaffUser } from "@/shared/types";
import {
  apiRequest,
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  KEEP_ALIVE_INTERVAL_MS,
  pingServerHealth,
  setStoredAuth,
} from "@/shared/api/client";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { fetchMyShiftScheduleApi } from "@/features/attendance";
import type { DrawerPageType, TabType } from "@/shared/ui/DrawerMenu";
import { getDefaultTabForRole, isBlockedFromWebPos } from "@/config/roles";
import { TABS_CONFIG } from "@/config/tabs";

export function useWebShell() {
  const [activeTab, setActiveTab] = useState<TabType>("POS");
  const [activeDrawerPage, setActiveDrawerPage] = useState<DrawerPageType>("NONE");
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [hasUnseenShiftSchedule, setHasUnseenShiftSchedule] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

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

  useEffect(() => {
    pingServerHealth();
    const timer = setInterval(() => {
      pingServerHealth();
    }, KEEP_ALIVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

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
        API_ENDPOINTS.AUTH.LOGIN,
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
      await apiRequest(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
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

  const currentTabConfig = TABS_CONFIG.find((t) => t.id === activeTab);
  const isCurrentTabAllowed = currentUser
    ? currentUser.role === "MARKETING"
      ? activeTab === "PUSH_PRODUCTS"
      : currentUser.role === "CEO" || currentUser.role === "ADMIN"
        ? true
        : (currentTabConfig?.allowedRoles.includes(currentUser.role) ?? false)
    : false;

  return {
    activeTab,
    setActiveTab,
    activeDrawerPage,
    setActiveDrawerPage,
    currentUser,
    setCurrentUser,
    checkingAuth,
    invoiceOrder,
    setInvoiceOrder,
    leftDrawerOpen,
    setLeftDrawerOpen,
    rightDrawerOpen,
    setRightDrawerOpen,
    hasUnseenShiftSchedule,
    setHasUnseenShiftSchedule,
    username,
    setUsername,
    password,
    setPassword,
    loginLoading,
    loginError,
    handleLoginSubmit,
    handleLogout,
    showChangePwdModal,
    setShowChangePwdModal,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    pwdSaving,
    pwdMessage,
    handleOpenChangePwd,
    handleChangePasswordSubmit,
    currentTabConfig,
    isCurrentTabAllowed,
  };
}
