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
  Save,
  Upload,
  FileText,
  Trash2,
  Eye,
} from "lucide-react";
import ContractFilePreviewModal from "./ContractFilePreviewModal";

export default function StaffModule({
  mode = "HR_FULL",
}: {
  mode?: "ADMIN_LOCK_ONLY" | "HR_FULL";
}) {
  const isAdminView = mode === "ADMIN_LOCK_ONLY";
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("123456");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [role, setRole] = useState<UserRole>("SALES");
  const [department, setDepartment] = useState<"OFFICE" | "SALES">("SALES");
  const [contractType, setContractType] = useState<"FULLTIME" | "PARTTIME" | "PROBATION">("FULLTIME");
  const [contractFileUrl, setContractFileUrl] = useState("");
  const [contractFileName, setContractFileName] = useState("");

  // Modal đổi mật khẩu cho nhân viên
  const [pwdTargetStaff, setPwdTargetStaff] = useState<StaffUser | null>(null);
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [confirmStaffPassword, setConfirmStaffPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  // Modal xem & chỉnh sửa chi tiết hồ sơ nhân sự (Dành cho HR)
  const [selectedStaffProfile, setSelectedStaffProfile] = useState<StaffUser | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCitizenId, setEditCitizenId] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDepartment, setEditDepartment] = useState<"OFFICE" | "SALES">("SALES");
  const [editContractType, setEditContractType] = useState<"FULLTIME" | "PARTTIME" | "PROBATION">("FULLTIME");
  const [editContractStart, setEditContractStart] = useState("");
  const [editContractEnd, setEditContractEnd] = useState("");
  const [editContractFileUrl, setEditContractFileUrl] = useState("");
  const [editContractFileName, setEditContractFileName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Modal xem trước file hợp đồng
  const [previewContractStaff, setPreviewContractStaff] = useState<{
    fullName: string;
    fileName: string;
    fileUrl: string;
  } | null>(null);

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

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error("Dung lượng file hợp đồng tối đa 8MB."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Không thể đọc file hợp đồng."));
      reader.readAsDataURL(file);
    });
  };

  const handleQuickUploadContract = async (st: StaffUser, file?: File) => {
    if (!file) return;
    setStatusMsg(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await apiRequest(`/staff/${st._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          contractFileUrl: dataUrl,
          contractFileName: file.name,
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã tải file hợp đồng "${file.name}" cho nhân sự ${st.fullName}!`,
      });
      loadStaff();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể tải file hợp đồng lên.",
      });
    }
  };

  const handleDeleteContractFile = async (st: StaffUser) => {
    setStatusMsg(null);
    try {
      await apiRequest(`/staff/${st._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          contractFileUrl: "",
          contractFileName: "",
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã xóa file hợp đồng của nhân sự "${st.fullName}"!`,
      });
      loadStaff();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể xóa file hợp đồng.",
      });
    }
  };

  const handleOpenProfileModal = (st: StaffUser) => {
    setSelectedStaffProfile(st);
    setEditFullName(st.fullName || "");
    setEditPhone(st.phone || "");
    setEditEmail(st.email || "");
    setEditCitizenId(st.citizenId || "");
    setEditAddress(st.address || "");
    setEditDepartment(st.department === "OFFICE" ? "OFFICE" : "SALES");
    setEditContractType(st.contractType || "FULLTIME");
    setEditContractStart(
      st.contractStartDate ? String(st.contractStartDate).slice(0, 10) : ""
    );
    setEditContractEnd(
      st.contractEndDate ? String(st.contractEndDate).slice(0, 10) : ""
    );
    setEditContractFileUrl(st.contractFileUrl || "");
    setEditContractFileName(st.contractFileName || "");
  };

  const handleSaveProfileModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffProfile) return;
    setProfileSaving(true);
    setStatusMsg(null);
    try {
      await apiRequest(`/staff/${selectedStaffProfile._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: editFullName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          citizenId: editCitizenId.trim(),
          address: editAddress.trim(),
          department: editDepartment,
          contractType: editContractType,
          contractStartDate: editContractStart || null,
          contractEndDate: editContractEnd || null,
          contractFileUrl: editContractFileUrl,
          contractFileName: editContractFileName,
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã lưu cập nhật hồ sơ nhân sự "${editFullName.trim()}" thành công!`,
      });
      setSelectedStaffProfile(null);
      loadStaff();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể lưu hồ sơ nhân sự.",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!username.trim()) return;
    if (!isAdminView && !fullName.trim()) return;
    try {
      const targetFullName = fullName.trim() || username.trim();
      await apiRequest("/staff", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password: password || "123456",
          fullName: targetFullName,
          phone: phone.trim(),
          email: email.trim(),
          citizenId: citizenId.trim(),
          role,
          department: role === "SALES" ? "SALES" : department || "OFFICE",
          contractType,
          contractFileUrl,
          contractFileName,
        }),
      });
      setUsername("");
      setFullName("");
      setPhone("");
      setEmail("");
      setCitizenId("");
      setContractFileUrl("");
      setContractFileName("");
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
      department?: "OFFICE" | "SALES";
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

      {/* Form Tạo Tài Khoản:
          - Admin (isAdminView): Tạo nhanh với Tên đăng nhập, Mật khẩu, Cấp Role (bao gồm ADMIN)
          - HR (!isAdminView): Tạo tài khoản kèm đầy đủ thông tin nhân sự (không có quyền cấp role ADMIN) */}
      <form
        onSubmit={handleCreateStaff}
        className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4"
      >
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-emerald-600" />
          {isAdminView
            ? "Tạo Tài Khoản Mới & Cấp Quyền (Admin)"
            : "Thêm Tài khoản Nhân viên Mới & Hồ sơ Nhân sự (HR)"}
        </h3>

        {isAdminView ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Tên đăng nhập *
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="VD: sales2, hr2..."
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

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Cấp Vai trò (Role) *
              </label>
              <select
                value={role}
                onChange={(e) => {
                  const nextRole = e.target.value as UserRole;
                  setRole(nextRole);
                  setDepartment(nextRole === "SALES" ? "SALES" : "OFFICE");
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-bold"
              >
                <option value="SALES">SALES (Bán hàng)</option>
                <option value="HR">HR (Nhân sự & Chấm công)</option>
                <option value="ACCOUNTANT">ACCOUNTANT (Kế toán & Kho)</option>
                <option value="MARKETING">MARKETING (Content Marketing)</option>
                <option value="ADMIN">ADMIN (Quản lý)</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
              >
                + Tạo Tài Khoản
              </button>
            </div>
          </div>
        ) : (
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
                Số điện thoại
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0909123456"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Vai trò (Role) *
              </label>
              <select
                value={role === "ADMIN" ? "SALES" : role}
                onChange={(e) => {
                  const nextRole = e.target.value as UserRole;
                  setRole(nextRole);
                  setDepartment(nextRole === "SALES" ? "SALES" : "OFFICE");
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-bold"
              >
                <option value="SALES">SALES (Bán hàng)</option>
                <option value="HR">HR (Nhân sự & Chấm công)</option>
                <option value="ACCOUNTANT">ACCOUNTANT (Kế toán & Kho)</option>
                <option value="MARKETING">MARKETING (Content Marketing)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Phòng ban (Khối) *
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as "OFFICE" | "SALES")}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-bold"
              >
                <option value="OFFICE">Khối Văn phòng</option>
                <option value="SALES">Khối Bán hàng (Showroom)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Loại hợp đồng
              </label>
              <select
                value={contractType}
                onChange={(e) =>
                  setContractType(e.target.value as "FULLTIME" | "PARTTIME" | "PROBATION")
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="FULLTIME">Chính thức (Full-time)</option>
                <option value="PARTTIME">Bán thời gian (Part-time)</option>
                <option value="PROBATION">Thử việc</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="VD: nhanvien@11sport.vn"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">CCCD / CMND</label>
              <input
                type="text"
                value={citizenId}
                onChange={(e) => setCitizenId(e.target.value)}
                placeholder="Số CCCD 12 số..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">
                File hợp đồng lao động (PDF / Ảnh / Word)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs transition">
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{contractFileName ? "Đổi file hợp đồng" : "Import file hợp đồng lên"}</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const url = await readFileAsDataUrl(f);
                        setContractFileUrl(url);
                        setContractFileName(f.name);
                      } catch (err: any) {
                        setStatusMsg({ type: "error", text: err?.message || "Lỗi đọc file" });
                      }
                      e.target.value = "";
                    }}
                  />
                </label>

                {contractFileName && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    <FileText className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span className="max-w-[180px] truncate">{contractFileName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setContractFileUrl("");
                        setContractFileName("");
                      }}
                      className="text-red-500 hover:text-red-700 ml-1"
                      title="Xóa file đã chọn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
              >
                + Tạo Nhân Viên Mới
              </button>
            </div>
          </div>
        )}
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
                <th className="py-3 px-4">Họ và tên & Liên hệ</th>
                <th className="py-3 px-4">CCCD & Địa chỉ</th>
                <th className="py-3 px-4">Khối</th>
                <th className="py-3 px-4">Vai trò (Role)</th>
                <th className="py-3 px-4">Hợp đồng & Thời hạn</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staffList.map((st) => {
                const normalizedRole =
                  st.role === ("WAREHOUSE" as any) ? "ACCOUNTANT" : st.role;
                const isTargetAdmin = normalizedRole === "ADMIN";
                const startStr = st.contractStartDate
                  ? String(st.contractStartDate).slice(0, 10)
                  : "";
                const endStr = st.contractEndDate
                  ? String(st.contractEndDate).slice(0, 10)
                  : "";

                return (
                  <tr key={st._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold">
                      {st.code || st._id.slice(-5)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{st.fullName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        @{st.username} • {st.phone || "Chưa có SĐT"}
                      </div>
                      {st.email && (
                        <div className="text-[11px] text-slate-400 font-mono">{st.email}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-800 font-semibold">
                        {st.citizenId || "Chưa có CCCD"}
                      </div>
                      <div className="text-[11px] text-slate-400 max-w-[180px] truncate" title={st.address || ""}>
                        {st.address || "Chưa cập nhật địa chỉ"}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          st.department === "OFFICE"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {st.department === "OFFICE" ? "Văn phòng" : "Bán hàng"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {/* Nếu HR đang xem dòng của ADMIN -> Không được sửa role của ADMIN */}
                      {!isAdminView && isTargetAdmin ? (
                        <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 font-mono font-bold text-xs text-emerald-800">
                          ADMIN (Quản lý)
                        </span>
                      ) : (
                        <select
                          value={normalizedRole}
                          onChange={(e) => {
                            const nextRole = e.target.value as UserRole;
                            handleUpdateStaff(st, {
                              role: nextRole,
                              department: nextRole === "SALES" ? "SALES" : "OFFICE",
                            });
                          }}
                          className="px-2 py-1 rounded border border-slate-300 bg-white font-bold text-xs"
                        >
                          <option value="SALES">SALES (Nhân viên bán hàng)</option>
                          <option value="HR">HR (Nhân sự & Chấm công)</option>
                          <option value="ACCOUNTANT">ACCOUNTANT (Kế toán & Kho)</option>
                          <option value="MARKETING">MARKETING (Content Marketing)</option>
                          {isAdminView && <option value="ADMIN">ADMIN (Quản lý)</option>}
                        </select>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-bold">
                        {st.contractType === "FULLTIME"
                          ? "Chính thức"
                          : st.contractType === "PARTTIME"
                          ? "Part-time"
                          : "Thử việc"}
                      </div>
                      {(startStr || endStr) && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {startStr || "?"} → {endStr || "Không TH"}
                        </div>
                      )}
                      <div className="mt-1.5">
                        {st.contractFileUrl ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                            Đã có HĐ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-semibold">
                            Chưa có HĐ
                          </span>
                        )}
                      </div>
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
                        {!isAdminView ? (
                          !isTargetAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenProfileModal(st)}
                                className="py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs transition"
                              >
                                Sửa hồ sơ
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenResetPassword(st)}
                                className="px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                              >
                                <KeyRound className="w-3.5 h-3.5" /> Đổi mật khẩu
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Tài khoản Quản lý</span>
                          )
                        ) : (
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
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Đổi mật khẩu cho nhân viên */}
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

      {/* Modal Chỉnh Sửa Chi Tiết Hồ Sơ Nhân Sự (Dành cho HR) */}
      {selectedStaffProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                  Chỉnh Sửa Hồ Sơ Nhân Sự ({selectedStaffProfile.code})
                </span>
                <h3 className="font-extrabold text-base text-white mt-0.5">
                  @{selectedStaffProfile.username} — {selectedStaffProfile.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffProfile(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfileModal} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Họ và tên nhân viên *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="0909..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="nhanvien@11sport.vn"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">CCCD / CMND</label>
                  <input
                    type="text"
                    value={editCitizenId}
                    onChange={(e) => setEditCitizenId(e.target.value)}
                    placeholder="Số CCCD 12 chữ số..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Phòng ban (Khối)
                  </label>
                  <select
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value as "OFFICE" | "SALES")}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs"
                  >
                    <option value="OFFICE">Khối Văn phòng</option>
                    <option value="SALES">Khối Bán hàng (Showroom)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Loại hợp đồng
                  </label>
                  <select
                    value={editContractType}
                    onChange={(e) =>
                      setEditContractType(
                        e.target.value as "FULLTIME" | "PARTTIME" | "PROBATION"
                      )
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs"
                  >
                    <option value="FULLTIME">Chính thức (Full-time)</option>
                    <option value="PARTTIME">Bán thời gian (Part-time)</option>
                    <option value="PROBATION">Thử việc</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Ngày bắt đầu hợp đồng
                  </label>
                  <input
                    type="date"
                    value={editContractStart}
                    onChange={(e) => setEditContractStart(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Ngày kết thúc hợp đồng
                  </label>
                  <input
                    type="date"
                    value={editContractEnd}
                    onChange={(e) => setEditContractEnd(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Địa chỉ thường trú / chỗ ở hiện tại
                  </label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Nhập địa chỉ nhân sự..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-800">
                    File hợp đồng lao động (Tải lên / Chỉnh sửa / Xóa)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {editContractFileUrl
                          ? "Thay thế file hợp đồng khác"
                          : "Import file hợp đồng lên"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const url = await readFileAsDataUrl(f);
                            setEditContractFileUrl(url);
                            setEditContractFileName(f.name);
                          } catch (err: any) {
                            setStatusMsg({
                              type: "error",
                              text: err?.message || "Lỗi đọc file hợp đồng",
                            });
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>

                    {editContractFileUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewContractStaff({
                              fullName: editFullName || selectedStaffProfile.fullName,
                              fileName: editContractFileName || "Hop-dong-lao-dong",
                              fileUrl: editContractFileUrl,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="max-w-[160px] truncate">
                            {editContractFileName || "Xem file hợp đồng"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditContractFileUrl("");
                            setEditContractFileName("");
                          }}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa file</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStaffProfile(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {profileSaving ? "Đang lưu..." : "Lưu thông tin nhân sự"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xem Trước / Tải Xuống File Hợp Đồng (Hỗ trợ PDF, DOCX, DOC, Ảnh) */}
      {previewContractStaff && (
        <ContractFilePreviewModal
          staffName={previewContractStaff.fullName}
          fileName={previewContractStaff.fileName}
          fileUrl={previewContractStaff.fileUrl}
          onClose={() => setPreviewContractStaff(null)}
        />
      )}
    </div>
  );
}
