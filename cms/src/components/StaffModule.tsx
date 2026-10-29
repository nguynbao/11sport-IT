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
} from "lucide-react";

export default function StaffModule() {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("123456");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("SALES");

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
    updates: { role?: UserRole; status?: "ACTIVE" | "LOCKED"; fullName?: string }
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
                <th className="py-3 px-4 text-right">Khóa / Mở khóa</th>
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
                  <td className="py-3 px-4 text-right">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
