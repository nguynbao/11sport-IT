"use client";


import { UserRole } from "@/shared/types";
import {
Download,
FileSpreadsheet,
FileText,
Loader2,
RotateCcw,
Trash2,
Upload,
UserPlus
} from "lucide-react";
import { downloadStaffImportTemplate } from "../exports";
import { StaffViewModel } from "../hooks/useStaffModule";
import { StaffCreateHrFields } from "./StaffCreateHrFields";

export function StaffCreateForm({ vm }: { vm: StaffViewModel }) {
  const {
    isCeo,
    isAdminView,
    username,
    setUsername,
    password,
    setPassword,
    role,
    setRole,
    setDepartment,
    setContractFileUrl,
    contractFileName,
    setContractFileName,
    importingExcel,
    setStatusMsg,
    readFileAsDataUrl,
    resetCreateForm,
    handleImportStaffExcel,
    handleCreateStaff,
  } = vm;

  return (
    <>
      {/* Form Tạo Tài Khoản:
          - Admin (isAdminView): Tạo nhanh với Tên đăng nhập, Mật khẩu, Cấp Role (bao gồm ADMIN)
          - HR (!isAdminView): Tạo tài khoản kèm đầy đủ thông tin nhân sự + nút Import nhanh từ Excel */}
      <form
        onSubmit={handleCreateStaff}
        className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand-ink" />
            {isAdminView
              ? "Tạo Tài Khoản Mới & Cấp Quyền (Admin)"
              : "Thêm Tài khoản Nhân viên Mới & Hồ sơ Nhân sự (HR)"}
          </h3>

          {!isAdminView && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={downloadStaffImportTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer"
                title="Tải file mẫu chuẩn (2 dòng tiêu đề gộp ô) của HR"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Tải file mẫu</span>
              </button>

              <label
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition cursor-pointer ${
                  importingExcel ? "opacity-70 pointer-events-none" : ""
                }`}
                title="Chọn file Excel (.xlsx) hoặc CSV (.csv) để tự động điền các ô thông tin hoặc tạo hàng loạt"
              >
                {importingExcel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>
                  {importingExcel ? "Đang đọc file..." : "Import nhanh từ Excel (.xlsx / .csv)"}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.csv,.tsv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportStaffExcel(f);
                    e.target.value = "";
                  }}
                />
              </label>

              <button
                type="button"
                onClick={resetCreateForm}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition cursor-pointer"
                title="Làm mới các ô đang nhập"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa form</span>
              </button>
            </div>
          )}
        </div>

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
                <option value="HR">HR (Nhân sự &amp; Chấm công)</option>
                <option value="ACCOUNTANT">ACCOUNTANT (Kế toán &amp; Kho)</option>
                <option value="MARKETING">MARKETING (Content Marketing)</option>
                <option value="ADMIN">ADMIN (Quản lý)</option>
                {isCeo && <option value="CEO">CEO (Giám đốc - Toàn quyền)</option>}
              </select>
            </div>

            <div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition"
              >
                + Tạo Tài Khoản
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Hàng Tài khoản hệ thống: Username, Mật khẩu, Vai trò */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                1. Tài khoản Đăng nhập &amp; Phân quyền Hệ thống
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Tên đăng nhập *
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: maunv (tự gợi ý khi import)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Vai trò hệ thống *
                  </label>
                  <select
                    value={!isCeo && (role === "ADMIN" || role === "CEO") ? "SALES" : role}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setRole(nextRole);
                      setDepartment(nextRole === "SALES" ? "SALES" : "OFFICE");
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-bold"
                  >
                    <option value="SALES">SALES (Bán hàng)</option>
                    <option value="HR">HR (Nhân sự &amp; Chấm công)</option>
                    <option value="ACCOUNTANT">ACCOUNTANT (Kế toán &amp; Kho)</option>
                    <option value="MARKETING">MARKETING (Content Marketing)</option>
                    {isCeo && <option value="ADMIN">ADMIN (Quản lý)</option>}
                    {isCeo && <option value="CEO">CEO (Giám đốc - Toàn quyền)</option>}
                  </select>
                </div>
              </div>
            </div>

      <StaffCreateHrFields vm={vm} />
            {/* Hàng cuối: File hợp đồng đính kèm + Nút Tạo nhân viên */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs transition">
                  <Upload className="w-3.5 h-3.5 text-brand-ink" />
                  <span>
                    {contractFileName
                      ? "Đổi file hợp đồng đính kèm"
                      : "Đính kèm file hợp đồng (PDF / Ảnh / Word)"}
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
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-brand-ink text-xs font-semibold">
                    <FileText className="w-3.5 h-3.5 shrink-0 text-brand-ink" />
                    <span className="max-w-[200px] truncate">{contractFileName}</span>
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

              <button
                type="submit"
                className="py-2.5 px-6 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                + Tạo Nhân Viên Mới
              </button>
            </div>
          </div>
        )}
      </form>

    </>
  );
}

