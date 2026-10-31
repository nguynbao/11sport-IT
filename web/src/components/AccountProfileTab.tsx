"use client";

import React, { useState, useEffect } from "react";
import {
  StaffUser,
  UserRole,
  apiRequest,
  cleanPhoneDigits,
  formatPhone,
  getStoredToken,
  setStoredAuth,
} from "@/lib/api";
import {
  User,
  Phone,
  ShieldCheck,
  BadgeCheck,
  KeyRound,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Hash,
  AtSign,
} from "lucide-react";

interface AccountProfileTabProps {
  currentUser: StaffUser;
  onUserUpdated: (updated: StaffUser) => void;
  onBack: () => void;
  getRoleDisplayName: (role?: UserRole) => string;
}

export default function AccountProfileTab({
  currentUser,
  onUserUpdated,
  onBack,
  getRoleDisplayName,
}: AccountProfileTabProps) {
  const [fullName, setFullName] = useState(currentUser.fullName || "");
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // State đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Đồng bộ lại thông tin mới nhất từ server khi mở trang
  useEffect(() => {
    let mounted = true;
    apiRequest<StaffUser[]>("/staff")
      .then((res) => {
        if (!mounted || !Array.isArray(res.data)) return;
        const found = res.data.find(
          (s) =>
            s._id === currentUser._id ||
            s.username?.toLowerCase() === currentUser.username?.toLowerCase()
        );
        if (found) {
          setFullName(found.fullName || "");
          setPhone(found.phone || "");
          const merged: StaffUser = {
            ...currentUser,
            ...found,
          };
          const token = getStoredToken();
          if (token) setStoredAuth(token, merged);
          onUserUpdated(merged);
        }
      })
      .catch(() => {
        // Giữ thông tin từ phiên hiện tại nếu offline/lỗi mạng
      });
    return () => {
      mounted = false;
    };
  }, [currentUser._id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    const cleanName = fullName.trim();
    const cleanPhone = cleanPhoneDigits(phone);

    if (!cleanName) {
      setProfileMsg({
        type: "error",
        text: "Họ và tên không được để trống.",
      });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await apiRequest<StaffUser>(`/staff/${currentUser._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: cleanName,
          phone: cleanPhone,
        }),
      });

      const updatedUser: StaffUser = {
        ...currentUser,
        ...(res.data || {}),
        fullName: res.data?.fullName || cleanName,
        phone: res.data?.phone !== undefined ? res.data.phone : cleanPhone,
      };

      const token = getStoredToken();
      if (token) {
        setStoredAuth(token, updatedUser);
      }
      onUserUpdated(updatedUser);

      setProfileMsg({
        type: "success",
        text: "Đã cập nhật thông tin cá nhân thành công!",
      });
    } catch (err: any) {
      setProfileMsg({
        type: "error",
        text:
          err?.message || "Không thể cập nhật thông tin cá nhân. Vui lòng thử lại.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwdMsg({
        type: "error",
        text: "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.",
      });
      return;
    }

    const cleanNew = newPassword.trim();
    if (cleanNew.length < 4) {
      setPwdMsg({
        type: "error",
        text: "Mật khẩu mới phải có ít nhất 4 ký tự.",
      });
      return;
    }

    if (cleanNew !== confirmPassword.trim()) {
      setPwdMsg({
        type: "error",
        text: "Xác nhận mật khẩu mới không khớp.",
      });
      return;
    }

    setSavingPwd(true);
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword: cleanNew,
          username: currentUser.username,
        }),
      });

      setPwdMsg({
        type: "success",
        text: "Đổi mật khẩu thành công!",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwdMsg({
        type: "error",
        text:
          err?.message || "Mật khẩu hiện tại không đúng hoặc không thể đổi mật khẩu.",
      });
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      {/* Thanh tiêu đề & nút Quay lại */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-extrabold text-slate-900">
              Thông tin tài khoản cá nhân
            </h2>
            <p className="text-xs text-slate-500">
              Xem hồ sơ nhân sự, cập nhật thông tin liên hệ và bảo mật tài khoản
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại làm việc</span>
        </button>
      </div>

      {/* Thẻ tóm tắt tài khoản */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-xl shrink-0">
            {(currentUser.fullName || currentUser.username || "U")
              .charAt(0)
              .toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="text-base md:text-lg font-extrabold flex flex-wrap items-center gap-2">
              <span>{currentUser.fullName}</span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-bold">
                {getRoleDisplayName(currentUser.role)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
              <span className="flex items-center gap-1 font-mono">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                Mã NV: <strong>{currentUser.code || "N/A"}</strong>
              </span>
              <span className="flex items-center gap-1 font-mono">
                <AtSign className="w-3.5 h-3.5 text-slate-400" />
                Username: <strong>{currentUser.username}</strong>
              </span>
              {currentUser.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  SĐT: <strong>{formatPhone(currentUser.phone)}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold">
          <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Đang hoạt động</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Cột 1: Chỉnh sửa thông tin cá nhân */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                Chỉnh sửa thông tin cá nhân
              </h3>
            </div>

            {profileMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 border ${
                  profileMsg.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                {profileMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Mã nhân viên
                </label>
                <input
                  type="text"
                  value={currentUser.code || ""}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-sm font-mono cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Tên đăng nhập
                </label>
                <input
                  type="text"
                  value={currentUser.username || ""}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-sm font-mono cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Họ và tên nhân sự <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Số điện thoại liên hệ
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  value={formatPhone(phone)}
                  onChange={(e) => setPhone(cleanPhoneDigits(e.target.value))}
                  placeholder="VD: 0901 234 567"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Vai trò phân quyền
              </label>
              <input
                type="text"
                value={getRoleDisplayName(currentUser.role)}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 text-sm font-semibold cursor-not-allowed"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow transition"
          >
            <Save className="w-4 h-4" />
            <span>
              {savingProfile ? "Đang lưu thay đổi..." : "Lưu thông tin cá nhân"}
            </span>
          </button>
        </form>

        {/* Cột 2: Đổi mật khẩu */}
        <form
          onSubmit={handleChangePassword}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <KeyRound className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                Đổi mật khẩu đăng nhập
              </h3>
            </div>

            {pwdMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 border ${
                  pwdMsg.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                {pwdMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{pwdMsg.text}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Mật khẩu hiện tại <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu đang sử dụng..."
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Mật khẩu mới <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 4 ký tự..."
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Xác nhận mật khẩu mới <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPwd}
            className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow transition"
          >
            <KeyRound className="w-4 h-4" />
            <span>{savingPwd ? "Đang cập nhật..." : "Cập nhật mật khẩu"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
