"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  LogOut,
  MapPin,
  Package,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import {
  formatPhoneVN,
  formatPriceByCurrency,
  normalizePhoneVN,
} from "@/lib/format";
import { useCurrencyStore } from "@/store/currencyStore";
import type {
  CustomerAddress,
  CustomerOrderSummary,
  CustomerProfile,
} from "@/types/storefront";

const CUSTOMER_TOKEN_KEY = "11sport_customer_token";

const SHARP_INPUT_CLS =
  "w-full h-[40px] px-3 rounded-none border border-[#dddddd] bg-white text-[14px] text-[#0a0a0a] placeholder:text-[#999999] focus:outline-none focus:border-[#224e40]";
const LABEL_CLS = "block text-[13px] font-bold text-[#222222] mb-1.5";

/**
 * 1:1 mipik.vn My Account (`/tai-khoan`) & Figma `Store/Account/AuthCard/Login` (9:1231)
 */
export function AccountClient() {
  const searchParams = useSearchParams();
  const currency = useCurrencyStore((s) => s.currency);
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);

  // Guest Mode
  const [guestMode, setGuestMode] = useState<"login" | "lookup">("login");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Guest Order Lookup
  const [lookupCode, setLookupCode] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupResult, setLookupResult] = useState<{
    orderCode: string;
    totalAmount: number;
    paymentStatus: string;
    fulfillmentStatus: string;
    createdAt?: string;
  } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Authenticated Dashboard Tabs
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "orders" | "addresses" | "profile"
  >("orders");
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // Add Address Form
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddr, setNewAddr] = useState<Omit<CustomerAddress, "id">>({
    label: "Nhà riêng",
    fullName: "",
    phone: "",
    province: "TP. Hồ Chí Minh",
    district: "",
    ward: "",
    addressLine: "",
    isDefault: false,
  });

  const loadAccountData = useCallback(async (jwt: string) => {
    try {
      const [meRes, ordersRes] = await Promise.all([
        apiFetch<{ data: CustomerProfile }>("/public/customers/me", {
          headers: { Authorization: `Bearer ${jwt}` },
        }),
        apiFetch<{ data: CustomerOrderSummary[] }>(
          "/public/customers/me/orders",
          {
            headers: { Authorization: `Bearer ${jwt}` },
          }
        ),
      ]);
      if (meRes?.data) {
        setProfile(meRes.data);
        setProfileName(meRes.data.name || "");
        setProfilePhone(formatPhoneVN(meRes.data.phone || ""));
      }
      setOrders(ordersRes?.data ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        setToken(null);
        setProfile(null);
      }
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(CUSTOMER_TOKEN_KEY);
      if (saved) {
        setToken(saved);
        loadAccountData(saved);
      }
    } catch {
      // Ignore storage errors
    }
  }, [loadAccountData]);

  useEffect(() => {
    if (searchParams.get("tab") === "lookup") {
      setGuestMode("lookup");
    }
  }, [searchParams]);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const handleRequestOtp = async () => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      setAuthError("Vui lòng nhập email hoặc số điện thoại để nhận mã OTP.");
      return;
    }
    const cleanId = trimmed.includes("@")
      ? trimmed.toLowerCase()
      : normalizePhoneVN(trimmed);
    if (!cleanId) {
      setAuthError("Email hoặc số điện thoại không hợp lệ.");
      return;
    }

    setOtpSending(true);
    setAuthError(null);
    setOtpNotice(null);
    try {
      const res = await apiFetch<{ message?: string; devOtp?: string }>(
        "/public/customers/request-otp",
        {
          method: "POST",
          body: JSON.stringify({
            identifier: cleanId,
            channel: trimmed.includes("@") ? "EMAIL" : "SMS",
          }),
        }
      );
      setOtpNotice(
        res?.devOtp
          ? `${res.message || "Mã OTP đã được gửi"} (OTP: ${res.devOtp})`
          : res?.message ||
              "Mã OTP 6 số đã được gửi. Vui lòng kiểm tra email / tin nhắn."
      );
      setOtpCooldown(60);
    } catch (err) {
      setAuthError(
        err instanceof ApiError
          ? err.message
          : "Không thể gửi mã OTP lúc này. Vui lòng thử lại."
      );
    } finally {
      setOtpSending(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed || !otp.trim()) {
      setAuthError("Vui lòng nhập email / số điện thoại và mã OTP 6 số.");
      return;
    }
    const cleanId = trimmed.includes("@")
      ? trimmed.toLowerCase()
      : normalizePhoneVN(trimmed);
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await apiFetch<{
        data: { token: string; customer: CustomerProfile };
      }>("/public/customers/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          identifier: cleanId,
          otp: otp.trim(),
        }),
      });
      if (res?.data?.token) {
        if (rememberMe) {
          localStorage.setItem(CUSTOMER_TOKEN_KEY, res.data.token);
        }
        setToken(res.data.token);
        setProfile(res.data.customer);
        setProfileName(res.data.customer.name || "");
        setProfilePhone(res.data.customer.phone || "");
        loadAccountData(res.data.token);
      }
    } catch (err) {
      setAuthError(
        err instanceof ApiError
          ? err.message
          : "Mã OTP không chính xác hoặc đã hết hạn. Vui lòng thử lại."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    setToken(null);
    setProfile(null);
    setOrders([]);
    setOtp("");
    setOtpNotice(null);
  };

  const handleSaveProfile = async (nextAddresses?: CustomerAddress[]) => {
    if (!token || !profile) return;
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const res = await apiFetch<{ data: CustomerProfile }>(
        "/public/customers/me",
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: profileName.trim(),
            phone: normalizePhoneVN(profilePhone),
            email: profile.email,
            addresses: nextAddresses ?? profile.addresses,
          }),
        }
      );
      if (res?.data) {
        setProfile(res.data);
      }
      setProfileNotice("Đã lưu thông tin tài khoản 11Sport thành công.");
    } catch {
      setProfileNotice("Không thể lưu thay đổi lúc này.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const created: CustomerAddress = {
      ...newAddr,
      id: `addr-${Date.now()}`,
      isDefault: profile.addresses.length === 0 || newAddr.isDefault,
    };
    const updated = created.isDefault
      ? [
          ...profile.addresses.map((a) => ({ ...a, isDefault: false })),
          created,
        ]
      : [...profile.addresses, created];
    await handleSaveProfile(updated);
    setShowAddAddress(false);
    setNewAddr({
      label: "Nhà riêng",
      fullName: "",
      phone: "",
      province: "TP. Hồ Chí Minh",
      district: "",
      ward: "",
      addressLine: "",
      isDefault: false,
    });
  };

  const handleDeleteAddress = async (id: string) => {
    if (!profile) return;
    const updated = profile.addresses.filter((a) => a.id !== id);
    await handleSaveProfile(updated);
  };

  const handleLookupOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupCode.trim() || !lookupPhone.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await apiFetch<{
        data: {
          orderCode: string;
          totalAmount: number;
          paymentStatus: string;
          fulfillmentStatus: string;
          createdAt?: string;
        };
      }>("/public/orders/lookup", {
        params: {
          code: lookupCode.trim(),
          phone: normalizePhoneVN(lookupPhone),
        },
      });
      setLookupResult(res?.data ?? null);
    } catch (err) {
      setLookupError(
        err instanceof ApiError
          ? err.message
          : "Không tìm thấy đơn hàng khớp với mã đơn và số điện thoại."
      );
    } finally {
      setLookupLoading(false);
    }
  };

  if (!mounted) {
    return <div className="h-64 bg-[#f8f9f5] animate-pulse" />;
  }

  // 1. GUEST VIEW — 1:1 mipik.vn Single-Column Sharp WooCommerce Login Form
  if (!token) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#ececec] pb-3">
          <h2 className="text-[19px] sm:text-[21px] font-bold uppercase tracking-wide text-[#0a0a0a]">
            {guestMode === "login" ? "ĐĂNG NHẬP" : "TRA CỨU ĐƠN HÀNG"}
          </h2>

          <div className="flex items-center gap-4 text-[13px]">
            <button
              type="button"
              onClick={() => setGuestMode("login")}
              className={
                guestMode === "login"
                  ? "font-bold text-[#224e40] underline underline-offset-4"
                  : "text-[#666666] hover:text-[#0a0a0a]"
              }
            >
              Đăng nhập tài khoản
            </button>
            <span className="text-[#cccccc]">|</span>
            <button
              type="button"
              onClick={() => setGuestMode("lookup")}
              className={
                guestMode === "lookup"
                  ? "font-bold text-[#224e40] underline underline-offset-4"
                  : "text-[#666666] hover:text-[#0a0a0a]"
              }
            >
              Tra cứu đơn hàng
            </button>
          </div>
        </div>

        {guestMode === "login" ? (
          <div className="space-y-4">
            {authError && (
              <div
                role="alert"
                className="p-3 rounded-none border border-[#dd3333]/35 bg-[#fef2f2] text-[#b91c1c] text-[13.5px] font-medium"
              >
                {authError}
              </div>
            )}

            {otpNotice && (
              <div
                role="status"
                className="p-3 rounded-none border border-[#dce5da] bg-[#f8f9f5] text-[#204b3e] text-[13.5px] font-medium"
              >
                {otpNotice}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-identifier" className={LABEL_CLS}>
                  Email hoặc số điện thoại{" "}
                  <span className="text-[#dd3333]">*</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="login-identifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="VD: khachhang@11sport.vn hoặc 0909 123 456"
                    className={`${SHARP_INPUT_CLS} sm:flex-1`}
                  />
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={otpSending || otpCooldown > 0}
                    className="h-[40px] px-4 rounded-none border border-[#224e40] bg-white hover:bg-[#f4f7f5] text-[#224e40] text-[12.5px] font-bold uppercase tracking-wider transition-colors disabled:opacity-55 whitespace-nowrap shrink-0"
                  >
                    {otpSending
                      ? "ĐANG GỬI..."
                      : otpCooldown > 0
                      ? `GỬI LẠI (${otpCooldown}s)`
                      : "Gửi mã OTP"}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="login-otp" className={LABEL_CLS}>
                  Mã xác thực OTP <span className="text-[#dd3333]">*</span>
                </label>
                <input
                  id="login-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Nhập mã OTP 6 số (Mock: 123456)"
                  className={`${SHARP_INPUT_CLS} font-mono tracking-widest`}
                />
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-[13.5px] text-[#333333] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#224e40]"
                  />
                  <span>Ghi nhớ phiên đăng nhập</span>
                </label>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="h-[40px] px-7 rounded-none bg-[#224e40] hover:bg-[#193b30] text-white text-[13px] font-bold uppercase tracking-wider transition-colors disabled:opacity-60"
                >
                  {authLoading ? "ĐANG ĐĂNG NHẬP..." : "ĐĂNG NHẬP"}
                </button>
              </div>

              <div>
                <Link
                  href="/tai-khoan/lost-password"
                  className="text-[13.5px] text-[#224e40] hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13.5px] text-[#555555]">
              Nhập mã đơn hàng (VD: ONL-20261120-0188) và số điện thoại nhận hàng.
            </p>

            <form onSubmit={handleLookupOrder} className="space-y-4">
              <div>
                <label htmlFor="lookup-code" className={LABEL_CLS}>
                  Mã đơn hàng <span className="text-[#dd3333]">*</span>
                </label>
                <input
                  id="lookup-code"
                  type="text"
                  required
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  placeholder="ONL-20261120-0188"
                  className={`${SHARP_INPUT_CLS} font-mono uppercase`}
                />
              </div>

              <div>
                <label htmlFor="lookup-phone" className={LABEL_CLS}>
                  Số điện thoại nhận hàng{" "}
                  <span className="text-[#dd3333]">*</span>
                </label>
                <input
                  id="lookup-phone"
                  type="tel"
                  required
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(formatPhoneVN(e.target.value))}
                  placeholder="0909 123 456"
                  className={`${SHARP_INPUT_CLS} tabular-nums`}
                />
              </div>

              <button
                type="submit"
                disabled={lookupLoading}
                className="h-[40px] px-7 rounded-none bg-[#224e40] hover:bg-[#193b30] text-white text-[13px] font-bold uppercase tracking-wider transition-colors disabled:opacity-60"
              >
                {lookupLoading ? "ĐANG TRA CỨU..." : "TRA CỨU ĐƠN HÀNG"}
              </button>
            </form>

            {lookupError && (
              <div
                role="alert"
                className="p-3 rounded-none border border-[#dd3333]/35 bg-[#fef2f2] text-[#b91c1c] text-[13.5px] font-medium"
              >
                {lookupError}
              </div>
            )}

            {lookupResult && (
              <div className="border border-[#dce5da] bg-[#f8f9f5] p-4 space-y-2 text-[14px] max-w-lg">
                <div className="flex justify-between">
                  <span className="text-[#555555]">Mã đơn:</span>
                  <strong className="font-mono text-[#224e40]">
                    {lookupResult.orderCode}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555555]">Tổng thanh toán:</span>
                  <strong className="text-[#dd3333] tabular-nums">
                    {formatPriceByCurrency(
                      lookupResult.totalAmount,
                      mounted ? currency : "VND"
                    )}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555555]">Thanh toán:</span>
                  <strong className="text-[#204b3e]">
                    {lookupResult.paymentStatus}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555555]">Trạng thái giao:</span>
                  <strong className="text-[#0a0a0a]">
                    {lookupResult.fulfillmentStatus}
                  </strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. AUTHENTICATED VIEW — Store/Account/DashboardNav (9:1259) & OrderTable (9:1288)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <aside className="lg:col-span-3 border border-[#e5e5e5] bg-[#fafafa] p-3 space-y-1">
        <div className="px-3 py-2.5 border-b border-[#ececec] mb-2">
          <p className="text-[11px] font-bold text-[#666666] uppercase">
            Tài khoản
          </p>
          <p className="text-sm font-bold text-[#224e40] truncate">
            {profile?.name || profile?.email || "Thành viên 11Sport"}
          </p>
        </div>

        {(
          [
            { key: "dashboard", label: "Bảng điều khiển", icon: CheckCircle2 },
            { key: "orders", label: "Đơn hàng của tôi", icon: Package },
            { key: "addresses", label: "Địa chỉ giao nhận", icon: MapPin },
            { key: "profile", label: "Chi tiết tài khoản", icon: User },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={`w-full h-10 px-3 rounded-none text-[13.5px] font-semibold inline-flex items-center gap-2.5 transition-colors ${
                active
                  ? "bg-[#224e40] text-white"
                  : "text-[#333333] hover:bg-white hover:text-[#224e40]"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full h-10 px-3 rounded-none text-[13.5px] font-semibold inline-flex items-center gap-2.5 text-[#dd3333] hover:bg-white transition-colors mt-2"
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Đăng xuất</span>
        </button>
      </aside>

      <div className="lg:col-span-9 border border-[#ececec] bg-white p-5 sm:p-6 space-y-5">
        {profileNotice && (
          <div
            role="status"
            className="p-3 bg-[#f8f9f5] border border-[#dce5da] text-[#204b3e] text-[13.5px] font-medium"
          >
            {profileNotice}
          </div>
        )}

        {activeTab === "dashboard" && (
          <div className="space-y-4">
            <h2 className="text-[17px] font-bold text-[#0a0a0a] uppercase">
              Xin chào, {profile?.name || "Thành viên 11Sport"}
            </h2>
            <p className="text-[14px] text-[#333333] leading-relaxed">
              Từ trang quản trị tài khoản 11Sport, bạn có thể theo dõi lịch sử{" "}
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className="font-bold text-[#224e40] underline"
              >
                đơn hàng gần đây ({orders.length})
              </button>
              , quản lý{" "}
              <button
                type="button"
                onClick={() => setActiveTab("addresses")}
                className="font-bold text-[#224e40] underline"
              >
                sổ địa chỉ giao hàng
              </button>{" "}
              và cập nhật thông tin cá nhân để nhận ưu đãi thành viên.
            </p>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-4">
            <h2 className="text-[17px] font-bold text-[#0a0a0a] uppercase">
              Lịch sử đơn hàng ({orders.length})
            </h2>
            {orders.length === 0 ? (
              <div className="bg-[#f8f9f5] border border-[#dce5da] p-8 text-center space-y-3">
                <p className="text-[14px] text-[#555555]">
                  Bạn chưa có đơn hàng nào tại 11Sport.
                </p>
                <Link
                  href="/vot-pickleball"
                  className="inline-flex items-center justify-center h-[39px] px-6 rounded-none bg-[#224e40] text-white text-xs font-bold uppercase tracking-wider"
                >
                  MUA SẮM NGAY
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13.5px]">
                  <thead>
                    <tr className="border-b-2 border-[#ececec] text-xs font-bold uppercase text-[#666666]">
                      <th className="py-3 pr-4">Đơn hàng</th>
                      <th className="py-3 pr-4">Ngày đặt</th>
                      <th className="py-3 pr-4">Trạng thái</th>
                      <th className="py-3 pr-4">Tổng cộng</th>
                      <th className="py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ececec]">
                    {orders.map((ord) => (
                      <tr key={ord._id || ord.orderCode}>
                        <td className="py-3.5 pr-4 font-mono font-bold text-[#224e40]">
                          #{ord.orderCode}
                        </td>
                        <td className="py-3.5 pr-4 text-[#555555]">
                          {new Date(ord.createdAt).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="py-3.5 pr-4">
                          <span className="inline-flex px-2.5 py-0.5 bg-[#f8f9f5] border border-[#dce5da] text-[#204b3e] text-xs font-semibold">
                            {ord.fulfillmentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4 font-bold text-[#0a0a0a] tabular-nums">
                          {formatPriceByCurrency(
                            ord.totalAmount,
                            mounted ? currency : "VND"
                          )}
                        </td>
                        <td className="py-3.5 text-right">
                          <Link
                            href={`/thanh-toan/order-received/${encodeURIComponent(ord.orderCode)}`}
                            className="inline-flex items-center h-8 px-3.5 rounded-none bg-[#224e40] hover:bg-[#193b30] text-white text-xs font-bold uppercase tracking-wider"
                          >
                            Xem
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "addresses" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[17px] font-bold text-[#0a0a0a] uppercase">
                Sổ địa chỉ giao hàng
              </h2>
              <button
                type="button"
                onClick={() => setShowAddAddress((p) => !p)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-none bg-[#224e40] text-white text-xs font-bold uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Thêm địa chỉ</span>
              </button>
            </div>

            {showAddAddress && (
              <form
                onSubmit={handleAddAddress}
                className="border border-[#dce5da] bg-[#f8f9f5] p-4 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={newAddr.fullName}
                    onChange={(e) =>
                      setNewAddr({ ...newAddr, fullName: e.target.value })
                    }
                    placeholder="Họ và tên người nhận"
                    className={SHARP_INPUT_CLS}
                  />
                  <input
                    type="tel"
                    required
                    value={newAddr.phone}
                    onChange={(e) =>
                      setNewAddr({
                        ...newAddr,
                        phone: formatPhoneVN(e.target.value),
                      })
                    }
                    placeholder="Số điện thoại (VD: 0909 123 456)"
                    className={`${SHARP_INPUT_CLS} tabular-nums`}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={newAddr.province}
                    onChange={(e) =>
                      setNewAddr({ ...newAddr, province: e.target.value })
                    }
                    placeholder="Tỉnh/TP"
                    className={SHARP_INPUT_CLS}
                  />
                  <input
                    type="text"
                    required
                    value={newAddr.district}
                    onChange={(e) =>
                      setNewAddr({ ...newAddr, district: e.target.value })
                    }
                    placeholder="Quận/Huyện"
                    className={SHARP_INPUT_CLS}
                  />
                  <input
                    type="text"
                    required
                    value={newAddr.ward}
                    onChange={(e) =>
                      setNewAddr({ ...newAddr, ward: e.target.value })
                    }
                    placeholder="Phường/Xã"
                    className={SHARP_INPUT_CLS}
                  />
                </div>
                <input
                  type="text"
                  required
                  value={newAddr.addressLine}
                  onChange={(e) =>
                    setNewAddr({ ...newAddr, addressLine: e.target.value })
                  }
                  placeholder="Số nhà, tên đường"
                  className={SHARP_INPUT_CLS}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAddress(false)}
                    className="h-9 px-4 rounded-none border border-[#dddddd] bg-white text-xs font-bold uppercase"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="h-9 px-5 rounded-none bg-[#224e40] text-white text-xs font-bold uppercase"
                  >
                    Lưu địa chỉ
                  </button>
                </div>
              </form>
            )}

            {!profile?.addresses?.length ? (
              <p className="text-[13.5px] text-[#666666] py-4">
                Chưa có địa chỉ nào được lưu.
              </p>
            ) : (
              <div className="space-y-3">
                {profile.addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="border border-[#ececec] p-4 flex items-start justify-between gap-3"
                  >
                    <div className="text-[13.5px] space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-[#0a0a0a]">
                          {addr.fullName}
                        </strong>
                        <span className="tabular-nums text-[#555555]">
                          {addr.phone}
                        </span>
                        {addr.isDefault && (
                          <span className="px-2 py-0.5 bg-[#f8f9f5] border border-[#dce5da] text-[#204b3e] text-xs font-bold">
                            Mặc định
                          </span>
                        )}
                      </div>
                      <p className="text-[#555555]">
                        {addr.addressLine}, {addr.ward}, {addr.district},{" "}
                        {addr.province}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      aria-label="Xóa địa chỉ"
                      className="w-9 h-9 inline-flex items-center justify-center text-[#888888] hover:text-[#dd3333]"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "profile" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveProfile();
            }}
            className="space-y-4 max-w-md"
          >
            <h2 className="text-[17px] font-bold text-[#0a0a0a] uppercase">
              Chi tiết tài khoản
            </h2>
            <div>
              <label htmlFor="profile-name" className={LABEL_CLS}>
                Họ và tên
              </label>
              <input
                id="profile-name"
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className={SHARP_INPUT_CLS}
              />
            </div>
            <div>
              <label htmlFor="profile-phone" className={LABEL_CLS}>
                Số điện thoại
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(formatPhoneVN(e.target.value))}
                className={`${SHARP_INPUT_CLS} tabular-nums`}
              />
            </div>
            <div>
              <label htmlFor="profile-email" className={LABEL_CLS}>
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                disabled
                value={profile?.email || ""}
                className="w-full h-[40px] px-3 rounded-none border border-[#dddddd] bg-[#f5f5f5] text-[14px] text-[#666666]"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="h-[40px] px-6 rounded-none bg-[#224e40] hover:bg-[#193b30] text-white text-[13px] font-bold uppercase tracking-wider"
            >
              {savingProfile ? "ĐANG LƯU..." : "LƯU THAY ĐỔI"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
