"use client";

import React, { useState, useEffect } from "react";
import { StaffUser, UserRole, apiRequest } from "@/lib/api";
import ExportExcelButton from "./ExportExcelButton";
import { exportStaff } from "@/lib/exports";
import {
  Users,
  UserPlus,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  X,
} from "lucide-react";

export default function StaffModule() {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("123456");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("SALES");

  // Modal đổi mật khẩu cho nhân viên / quản trị viên
  const [pwdTargetStaff, setPwdTargetStaff] = useState<StaffUser | null>(null);
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [confirmStaffPassword, setConfirmStaffPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadStaff = async () => {
    try {
      const res = await apiRequest<StaffUser[]>("/staff");
      setStaffList(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!username.trim() || !fullName.trim()) return;
    try {
      await apiRequest("/staff", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password: password || "123456",
          fullName: fullName.trim(),
          phone: phone.trim(),
          role,
        }),
      });
      setUsername("");
      setFullName("");
      setPhone("");
      setStatusMsg({
        type: "success",
        text: "Đã tạo tài khoản nhân viên mới thành công!",
      });
      loadStaff();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể tạo nhân viên mới.",
      });
    }
  };

  const handleUpdateStaff = async (
    staff: StaffUser,
    updates: {
      role?: UserRole;
      status?: "ACTIVE" | "LOCKED";
      fullName?: string;
      password?: string;
    }
  ) => {
    setStatusMsg(null);
    try {
      await apiRequest(`/staff/${staff._id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      setStatusMsg({
        type: "success",
        text: `Đã cập nhật nhân viên "${staff.fullName}" thành công!`,
      });
      loadStaff();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Lỗi khi cập nhật nhân viên.",
      });
    }
  };

  const handleOpenResetPassword = (staff: StaffUser) => {
    setPwdTargetStaff(staff);
    setNewStaffPassword("");
    setConfirmStaffPassword("");
    setStatusMsg(null);
  };

  const handleResetStaffPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdTargetStaff) return;
    setStatusMsg(null);
    const cleanPwd = newStaffPassword.trim();
    if (cleanPwd.length < 4) {
      setStatusMsg({
        type: "error",
        text: "Mật khẩu mới phải có ít nhất 4 ký tự.",
      });
      return;
    }
    if (cleanPwd !== confirmStaffPassword.trim()) {
      setStatusMsg({
        type: "error",
        text: "Xác nhận mật khẩu mới không khớp.",
      });
      return;
    }

    setPwdSaving(true);
    try {
      await apiRequest(`/staff/${pwdTargetStaff._id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: cleanPwd }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã đổi mật khẩu cho tài khoản "${pwdTargetStaff.username}" (${pwdTargetStaff.fullName}) thành công!`,
      });
      setPwdTargetStaff(null);
      setNewStaffPassword("");
      setConfirmStaffPassword("");
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể đổi mật khẩu cho tài khoản này.",
      });
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            statusMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Form thêm nhân viên */}
      <form
        onSubmit={handleCreateStaff}
        className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4"
      >
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-emerald-600" />
          Thêm Tài khoản Nhân viên Mới & Phân quyền (RBAC)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Tên đăng nhập *
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="VD: sales2"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Mật khẩu *
            </label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Họ và tên nhân viên *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="VD: Phạm Thị Thu Ngân"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Vai trò (Role) *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-bold"
            >
              <option value="SALES">SALES (Bán hàng)</option>
              <option value="WAREHOUSE">WAREHOUSE (Thủ kho)</option>
              <option value="ADMIN">ADMIN (Quản lý)</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              + Tạo Nhân Viên
            </button>
          </div>
        </div>
      </form>

      {/* Danh sách nhân viên */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Danh sách Nhân viên ({staffList.length})
          </h3>
          <ExportExcelButton onExport={() => exportStaff(staffList)} disabled={staffList.length === 0} />
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="py-3 px-4">Mã NV</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Họ và tên</th>
                <th className="py-3 px-4">Phân quyền (Role)</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Đổi mật khẩu / Khóa TK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staffList.map((st) => (
                <tr key={st._id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold">
                    {st.code || st._id.slice(-5)}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                    {st.username}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {st.fullName}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={st.role}
                      onChange={(e) =>
                        handleUpdateStaff(st, {
                          role: e.target.value as UserRole,
                        })
                      }
                      className="px-2.5 py-1.5 rounded border border-slate-300 bg-white font-bold text-xs"
                    >
                      <option value="SALES">SALES (Nhân viên bán hàng)</option>
                      <option value="WAREHOUSE">WAREHOUSE (Thủ kho)</option>
                      <option value="ADMIN">ADMIN (Quản lý)</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        st.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {st.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenResetPassword(st)}
                        className="px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                      >
                        <KeyRound className="w-3.5 h-3.5" /> Đổi mật khẩu
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateStaff(st, {
                            status: st.status === "ACTIVE" ? "LOCKED" : "ACTIVE",
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 ${
                          st.status === "ACTIVE"
                            ? "bg-red-50 hover:bg-red-100 text-red-600"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {st.status === "ACTIVE" ? (
                          <>
                            <Lock className="w-3.5 h-3.5" /> Khóa TK
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3.5 h-3.5" /> Mở khóa
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Đổi mật khẩu cho nhân viên / Admin */}
      {pwdTargetStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <h4 className="font-extrabold text-sm">
                  Đổi mật khẩu tài khoản: {pwdTargetStaff.username}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPwdTargetStaff(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetStaffPassword} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>
                  Nhân sự: <strong className="text-slate-900">{pwdTargetStaff.fullName}</strong>
                </div>
                <div>
                  Username: <span className="font-mono font-bold">{pwdTargetStaff.username}</span> · Vai trò:{" "}
                  <span className="font-mono font-bold text-emerald-700">{pwdTargetStaff.role}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mật khẩu mới (Tối thiểu 4 ký tự) *
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
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
                  value={confirmStaffPassword}
                  onChange={(e) => setConfirmStaffPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPwdTargetStaff(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow"
                >
                  {pwdSaving ? "Đang lưu..." : "Lưu mật khẩu mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
