"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  StaffUser,
  UserRole,
  apiRequest,
  ContractType,
  CONTRACT_TYPE_OPTIONS,
  contractTypeLabel,
  formatVND,
} from "@/lib/api";
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
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from "lucide-react";
import ContractFilePreviewModal from "./ContractFilePreviewModal";

/** Định dạng số nguyên thành chuỗi có dấu chấm phân cách hàng nghìn (VD: 10000 -> "10.000", 0 -> "") */
function formatMoneyInput(val: number | string | undefined | null): string {
  const digits = String(val ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

/** Chuyển chuỗi có dấu chấm phân cách về số nguyên không âm */
function parseMoneyInput(raw: string): number {
  const digits = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return 0;
  return Number(digits) || 0;
}

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
  const [companyEmail, setCompanyEmail] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [role, setRole] = useState<UserRole>("SALES");
  const [department, setDepartment] = useState<"OFFICE" | "SALES">("SALES");
  // Bắt buộc HR chọn loại hợp đồng khi tạo tài khoản (không có mặc định)
  const [contractType, setContractType] = useState<ContractType | "">("");
  const [contractFileUrl, setContractFileUrl] = useState("");
  const [contractFileName, setContractFileName] = useState("");
  const [baseSalary, setBaseSalary] = useState<string>("");
  const [allowance, setAllowance] = useState<string>("");
  const [bonus, setBonus] = useState<string>("");
  const [insurance, setInsurance] = useState<string>("");

  // Bộ lọc & sắp xếp Danh sách Nhân viên
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDept, setFilterDept] = useState<"ALL" | "OFFICE" | "SALES">("ALL");
  const [filterRole, setFilterRole] = useState<"ALL" | UserRole>("ALL");
  const [filterContract, setFilterContract] = useState<"ALL" | ContractType>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "LOCKED">("ALL");
  const [sortBy, setSortBy] = useState<
    "code" | "fullName" | "baseSalary" | "allowance" | "bonus" | "insurance" | "createdAt"
  >("code");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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
  const [editCompanyEmail, setEditCompanyEmail] = useState("");
  const [editCitizenId, setEditCitizenId] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDepartment, setEditDepartment] = useState<"OFFICE" | "SALES">("SALES");
  const [editContractType, setEditContractType] = useState<ContractType>("PROBATION");
  const [editProbationMonths, setEditProbationMonths] = useState<number>(2);
  const [editContractStart, setEditContractStart] = useState("");
  const [editContractEnd, setEditContractEnd] = useState("");
  const [editContractFileUrl, setEditContractFileUrl] = useState("");
  const [editContractFileName, setEditContractFileName] = useState("");
  const [editBaseSalary, setEditBaseSalary] = useState<number>(0);
  const [editAllowance, setEditAllowance] = useState<number>(0);
  const [editBonus, setEditBonus] = useState<number>(0);
  const [editInsurance, setEditInsurance] = useState<number>(0);
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
    setEditCompanyEmail(st.companyEmail || "");
    setEditCitizenId(st.citizenId || "");
    setEditAddress(st.address || "");
    setEditDepartment(st.department === "OFFICE" ? "OFFICE" : "SALES");
    setEditContractType(st.contractType || "PROBATION");
    setEditProbationMonths(
      st.probationMonths !== undefined &&
        st.probationMonths !== null &&
        !(st.contractType === "PROBATION" && Number(st.probationMonths) === 0)
        ? Math.min(2, Math.max(0, Number(st.probationMonths)))
        : st.contractType === "PROBATION"
          ? 2
          : 0
    );
    setEditContractStart(
      st.contractStartDate ? String(st.contractStartDate).slice(0, 10) : ""
    );
    setEditContractEnd(
      st.contractEndDate ? String(st.contractEndDate).slice(0, 10) : ""
    );
    setEditContractFileUrl(st.contractFileUrl || "");
    setEditContractFileName(st.contractFileName || "");
    setEditBaseSalary(Number(st.baseSalary || 0));
    setEditAllowance(Number(st.allowance || 0));
    setEditBonus(Number(st.bonus || 0));
    setEditInsurance(Number(st.insurance || 0));
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
          companyEmail: editCompanyEmail.trim(),
          citizenId: editCitizenId.trim(),
          address: editAddress.trim(),
          department: editDepartment,
          contractType: editContractType,
          probationMonths:
            editContractType === "INTERN"
              ? 0
              : Math.min(2, Math.max(0, Number(editProbationMonths) || 0)),
          contractStartDate: editContractStart || null,
          contractEndDate: editContractEnd || null,
          contractFileUrl: editContractFileUrl,
          contractFileName: editContractFileName,
          baseSalary: Math.max(0, Number(editBaseSalary) || 0),
          allowance: Math.max(0, Number(editAllowance) || 0),
          bonus: Math.max(0, Number(editBonus) || 0),
          insurance: Math.max(0, Number(editInsurance) || 0),
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã lưu cập nhật hồ sơ & chế độ lương của "${editFullName.trim()}" thành công!`,
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
    if (!isAdminView && !contractType) {
      setStatusMsg({ type: "error", text: "Vui lòng chọn Loại hợp đồng (Thực tập / Thử việc / Chính thức)." });
      return;
    }
    try {
      const targetFullName = fullName.trim() || username.trim();
      const payload: Record<string, any> = {
        username: username.trim(),
        password: password || "123456",
        fullName: targetFullName,
        phone: phone.trim(),
        email: email.trim(),
        companyEmail: companyEmail.trim(),
        citizenId: citizenId.trim(),
        role,
        department: role === "SALES" ? "SALES" : department || "OFFICE",
        contractType: contractType || undefined,
        contractFileUrl,
        contractFileName,
      };
      if (!isAdminView) {
        payload.baseSalary = parseMoneyInput(baseSalary);
        payload.allowance = parseMoneyInput(allowance);
        payload.bonus = parseMoneyInput(bonus);
        payload.insurance = parseMoneyInput(insurance);
      }
      await apiRequest("/staff", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUsername("");
      setContractType("");
      setFullName("");
      setPhone("");
      setEmail("");
      setCompanyEmail("");
      setCitizenId("");
      setContractFileUrl("");
      setContractFileName("");
      setBaseSalary("");
      setAllowance("");
      setBonus("");
      setInsurance("");
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

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    filterDept !== "ALL" ||
    filterRole !== "ALL" ||
    filterContract !== "ALL" ||
    filterStatus !== "ALL" ||
    sortBy !== "code" ||
    sortOrder !== "asc";

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterDept("ALL");
    setFilterRole("ALL");
    setFilterContract("ALL");
    setFilterStatus("ALL");
    setSortBy("code");
    setSortOrder("asc");
  };

  const handleColumnSort = (
    field: "code" | "fullName" | "baseSalary" | "allowance" | "bonus" | "insurance" | "createdAt"
  ) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(
        ["baseSalary", "allowance", "bonus", "insurance"].includes(field) ? "desc" : "asc"
      );
    }
  };

  const filteredStaffList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = staffList.filter((st) => {
      const normalizedRole = st.role === ("WAREHOUSE" as any) ? "ACCOUNTANT" : st.role;
      const dept = st.department || (normalizedRole === "SALES" ? "SALES" : "OFFICE");
      if (filterDept !== "ALL" && dept !== filterDept) return false;
      if (filterRole !== "ALL" && normalizedRole !== filterRole) return false;
      if (filterContract !== "ALL" && (st.contractType || "PROBATION") !== filterContract) {
        return false;
      }
      if (filterStatus !== "ALL" && st.status !== filterStatus) return false;
      if (q) {
        const hay = [
          st.code,
          st.fullName,
          st.username,
          st.phone,
          st.email,
          st.companyEmail,
          st.citizenId,
          st.address,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dir = sortOrder === "desc" ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (["baseSalary", "allowance", "bonus", "insurance"].includes(sortBy)) {
        const va = Number((a as any)[sortBy] || 0);
        const vb = Number((b as any)[sortBy] || 0);
        return (va - vb) * dir;
      }
      if (sortBy === "createdAt") {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return (ta - tb) * dir;
      }
      if (sortBy === "fullName") {
        return (a.fullName || "").localeCompare(b.fullName || "", "vi") * dir;
      }
      return (a.code || "").localeCompare(b.code || "", "vi") * dir;
    });
  }, [staffList, searchQuery, filterDept, filterRole, filterContract, filterStatus, sortBy, sortOrder]);

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${statusMsg.type === "success"
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
                Loại hợp đồng *
              </label>
              <select
                required={!isAdminView}
                value={contractType}
                onChange={(e) => setContractType(e.target.value as ContractType | "")}
                className={`w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-bold ${contractType ? "border-slate-300" : "border-amber-400 text-slate-400"
                  }`}
              >
                <option value="" disabled>
                  -- Chọn loại hợp đồng --
                </option>
                {CONTRACT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {contractType && (
                <p className="text-[10px] text-slate-500 mt-1">
                  {CONTRACT_TYPE_OPTIONS.find((o) => o.value === contractType)?.desc}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Email liên hệ</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="VD: ca_nhan@gmail.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Email công ty</label>
              <input
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
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

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Lương cơ bản (VNĐ)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatMoneyInput(baseSalary)}
                onChange={(e) => setBaseSalary(String(parseMoneyInput(e.target.value) || ""))}
                placeholder="VD: 8.000.000"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Trợ cấp (VNĐ)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatMoneyInput(allowance)}
                onChange={(e) => setAllowance(String(parseMoneyInput(e.target.value) || ""))}
                placeholder="VD: 1.000.000"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Thưởng (VNĐ)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatMoneyInput(bonus)}
                onChange={(e) => setBonus(String(parseMoneyInput(e.target.value) || ""))}
                placeholder="VD: 500.000"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Bảo hiểm (VNĐ)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatMoneyInput(insurance)}
                onChange={(e) => setInsurance(String(parseMoneyInput(e.target.value) || ""))}
                placeholder="VD: 850.000"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>

            <div className="md:col-span-3">
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Danh sách Nhân viên ({filteredStaffList.length}/{staffList.length})
          </h3>
          <ExportExcelButton
            onExport={() => exportStaff(filteredStaffList)}
            disabled={filteredStaffList.length === 0}
          />
        </div>

        {/* Thanh Bộ lọc (Filter) & Sắp xếp (Sort) */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-wrap items-center gap-2 text-xs">
          {/* Tìm kiếm */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên, mã NV, username, SĐT, CCCD..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Lọc theo Khối */}
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value as "ALL" | "OFFICE" | "SALES")}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Tất cả Khối</option>
            <option value="OFFICE">Khối Văn phòng</option>
            <option value="SALES">Khối Bán hàng</option>
          </select>

          {/* Lọc theo Vai trò */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as "ALL" | UserRole)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Tất cả Vai trò</option>
            <option value="SALES">SALES (Bán hàng)</option>
            <option value="HR">HR (Nhân sự)</option>
            <option value="ACCOUNTANT">ACCOUNTANT (Kế toán &amp; Kho)</option>
            <option value="MARKETING">MARKETING</option>
            <option value="ADMIN">ADMIN (Quản lý)</option>
          </select>

          {/* Lọc theo Loại hợp đồng */}
          <select
            value={filterContract}
            onChange={(e) => setFilterContract(e.target.value as "ALL" | ContractType)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Tất cả Hợp đồng</option>
            <option value="FULLTIME">Chính thức</option>
            <option value="PROBATION">Thử việc</option>
            <option value="INTERN">Thực tập (Intern)</option>
          </select>

          {/* Lọc theo Trạng thái */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "ALL" | "ACTIVE" | "LOCKED")}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Tất cả Trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
          </select>

          {/* Sắp xếp (Sort) */}
          <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-bold text-slate-500">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as
                  | "code"
                  | "fullName"
                  | "baseSalary"
                  | "allowance"
                  | "bonus"
                  | "insurance"
                  | "createdAt"
                )
              }
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="code">Mã NV</option>
              <option value="fullName">Họ và tên</option>
              <option value="baseSalary">Lương cơ bản</option>
              <option value="allowance">Trợ cấp</option>
              <option value="bonus">Thưởng</option>
              <option value="insurance">Bảo hiểm</option>
              <option value="createdAt">Ngày tạo</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              title={sortOrder === "asc" ? "Đang xếp Tăng dần" : "Đang xếp Giảm dần"}
              className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-0.5 cursor-pointer"
            >
              {sortOrder === "asc" ? (
                <>
                  <ArrowUp className="w-3 h-3 text-emerald-600" />
                  <span className="text-[10px]">Tăng</span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-3 h-3 text-amber-600" />
                  <span className="text-[10px]">Giảm</span>
                </>
              )}
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold inline-flex items-center gap-1 cursor-pointer transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đặt lại</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th
                  onClick={() => handleColumnSort("code")}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-800 select-none whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1">
                    Mã NV
                    {sortBy === "code" &&
                      (sortOrder === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      ))}
                  </span>
                </th>
                <th
                  onClick={() => handleColumnSort("fullName")}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-800 select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    Họ và tên &amp; Liên hệ
                    {sortBy === "fullName" &&
                      (sortOrder === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      ))}
                  </span>
                </th>
                <th className="py-3 px-3.5">CCCD &amp; Địa chỉ</th>
                <th className="py-3 px-3.5">Khối</th>
                <th className="py-3 px-3.5">Vai trò (Role)</th>
                <th className="py-3 px-3.5">Hợp đồng &amp; Thời hạn</th>
                <th className="py-3 px-3.5 text-center">Trạng thái</th>
                <th className="py-3 px-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStaffList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 text-xs">
                    Không tìm thấy nhân viên nào khớp bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredStaffList.map((st) => {
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
                      <td className="py-3 px-3.5 font-mono font-bold">
                        {st.code || st._id.slice(-5)}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">{st.fullName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          @{st.username} • {st.phone || "Chưa có SĐT"}
                        </div>
                        {st.email && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            <span className="text-slate-400">LH:</span> {st.email}
                          </div>
                        )}
                        {st.companyEmail && (
                          <div className="text-[11px] text-emerald-700 font-mono">
                            <span className="text-slate-400">Cty:</span> {st.companyEmail}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-mono text-slate-800 font-semibold">
                          {st.citizenId || "Chưa có CCCD"}
                        </div>
                        <div className="text-[11px] text-slate-400 max-w-[160px] truncate" title={st.address || ""}>
                          {st.address || "Chưa cập nhật địa chỉ"}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${st.department === "OFFICE"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                        >
                          {st.department === "OFFICE" ? "Văn phòng" : "Bán hàng"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
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
                            <option value="HR">HR (Nhân sự &amp; Chấm công)</option>
                            <option value="ACCOUNTANT">ACCOUNTANT (Kế toán &amp; Kho)</option>
                            <option value="MARKETING">MARKETING (Content Marketing)</option>
                            {isAdminView && <option value="ADMIN">ADMIN (Quản lý)</option>}
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="text-slate-800 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] ${st.contractType === "FULLTIME"
                              ? "bg-emerald-50 text-emerald-700"
                              : st.contractType === "INTERN"
                                ? "bg-sky-50 text-sky-700"
                                : "bg-amber-50 text-amber-700"
                              }`}
                          >
                            {contractTypeLabel(st.contractType)}
                          </span>
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
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${st.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-700"
                            }`}
                        >
                          {st.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
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
                              className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 ${st.status === "ACTIVE"
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
                })
              )}
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
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
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

            <form onSubmit={handleSaveProfileModal} className="p-6 space-y-4 text-xs overflow-y-auto">
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
                  <label className="block font-bold text-slate-700 mb-1">Email liên hệ</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="ca_nhan@gmail.com"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email công ty</label>
                  <input
                    type="email"
                    value={editCompanyEmail}
                    onChange={(e) => setEditCompanyEmail(e.target.value)}
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
                    onChange={(e) => {
                      const nextType = e.target.value as ContractType;
                      setEditContractType(nextType);
                      if (
                        nextType === "FULLTIME" &&
                        selectedStaffProfile?.contractType === "PROBATION" &&
                        editProbationMonths === 0
                      ) {
                        setEditProbationMonths(2);
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs"
                  >
                    {CONTRACT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    {editContractType === "PARTTIME" && (
                      <option value="PARTTIME">Bán thời gian (cũ – vui lòng chọn lại)</option>
                    )}
                  </select>
                </div>

                {(editContractType === "PROBATION" || editContractType === "FULLTIME") && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Số tháng thử việc
                    </label>
                    <select
                      value={editProbationMonths}
                      onChange={(e) => setEditProbationMonths(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs"
                    >
                      <option value={0}>0 tháng (Vào thẳng chính thức)</option>
                      <option value={1}>1 tháng thử việc (+1 ngày phép khi lên Chính thức)</option>
                      <option value={2}>2 tháng thử việc (+2 ngày phép khi lên Chính thức)</option>
                    </select>
                  </div>
                )}

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

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Lương cơ bản (VNĐ)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatMoneyInput(editBaseSalary)}
                    onChange={(e) => setEditBaseSalary(parseMoneyInput(e.target.value))}
                    placeholder="0"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Trợ cấp (VNĐ)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatMoneyInput(editAllowance)}
                    onChange={(e) => setEditAllowance(parseMoneyInput(e.target.value))}
                    placeholder="0"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Thưởng (VNĐ)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatMoneyInput(editBonus)}
                    onChange={(e) => setEditBonus(parseMoneyInput(e.target.value))}
                    placeholder="0"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bảo hiểm (VNĐ)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatMoneyInput(editInsurance)}
                    onChange={(e) => setEditInsurance(parseMoneyInput(e.target.value))}
                    placeholder="0"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-800">
                    File hợp đồng lao động
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
