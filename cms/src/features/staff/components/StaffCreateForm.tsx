"use client";

import React, { useState, useEffect, useMemo } from "react";
import { StaffUser, UserRole, ContractType, ParsedStaffImportRow } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { CONTRACT_TYPE_OPTIONS, contractTypeLabel, formatVND } from "@/shared/utils/format";
import { parseStaffImportFileApi } from "../api";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { exportStaff, downloadStaffImportTemplate } from "../exports";
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
  FileSpreadsheet,
  Download,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";
import ContractFilePreviewModal from "@/shared/ui/ContractFilePreviewModal";
import { formatMoneyInput, parseMoneyInput, toIsoDateSlice } from "../utils";
import { StaffViewModel } from "../hooks/useStaffModule";

export function StaffCreateForm({ vm }: { vm: StaffViewModel }) {
  const {
    isCeo,
    isAdminView,
    username,
    setUsername,
    password,
    setPassword,
    fullName,
    setFullName,
    phone,
    setPhone,
    email,
    setEmail,
    companyEmail,
    setCompanyEmail,
    dateOfBirth,
    setDateOfBirth,
    gender,
    setGender,
    nationality,
    setNationality,
    citizenId,
    setCitizenId,
    citizenIssueDate,
    setCitizenIssueDate,
    citizenIssuePlace,
    setCitizenIssuePlace,
    permanentAddress,
    setPermanentAddress,
    currentAddress,
    setCurrentAddress,
    school,
    setSchool,
    major,
    setMajor,
    positionTitle,
    setPositionTitle,
    bankAccount,
    setBankAccount,
    role,
    setRole,
    department,
    setDepartment,
    contractType,
    setContractType,
    contractStartDate,
    setContractStartDate,
    contractEndDate,
    setContractEndDate,
    internContractNumber,
    setInternContractNumber,
    probationContractNumber,
    setProbationContractNumber,
    officialContractNumber,
    setOfficialContractNumber,
    bhxhStartDate,
    setBhxhStartDate,
    bhxhEndDate,
    setBhxhEndDate,
    recordedLeaveDays,
    setRecordedLeaveDays,
    setContractFileUrl,
    contractFileName,
    setContractFileName,
    baseSalary,
    setBaseSalary,
    allowance,
    setAllowance,
    bonus,
    setBonus,
    insurance,
    setInsurance,
    showExtendedCreate,
    setShowExtendedCreate,
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

            {/* Khung 26 trường chuẩn theo đúng mẫu Import Nhân sự của HR */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-brand-ink">
                  2. Thông tin Hồ sơ Nhân sự theo Mẫu Chuẩn (BẮT ĐẦU → STK)
                </div>
                <button
                  type="button"
                  onClick={() => setShowExtendedCreate((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-ink hover:text-brand-ink cursor-pointer"
                >
                  {showExtendedCreate ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <span>{showExtendedCreate ? "Thu gọn" : "Mở rộng đầy đủ"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    BẮT ĐẦU
                  </label>
                  <input
                    type="date"
                    value={contractStartDate}
                    onChange={(e) => setContractStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    KẾT THÚC
                  </label>
                  <input
                    type="date"
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    HỌ TÊN *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="VD: Nguyễn Văn Mẫu"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    NGÀY SINH
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    GIỚI TÍNH
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                  >
                    <option value="">-- Chọn --</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              {showExtendedCreate && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        QUỐC TỊCH
                      </label>
                      <input
                        type="text"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        placeholder="Việt Nam"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        CMND / CCCD
                      </label>
                      <input
                        type="text"
                        value={citizenId}
                        onChange={(e) => setCitizenId(e.target.value)}
                        placeholder="VD: 048201001234"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        NGÀY CẤP
                      </label>
                      <input
                        type="date"
                        value={citizenIssueDate}
                        onChange={(e) => setCitizenIssueDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        NƠI CẤP
                      </label>
                      <input
                        type="text"
                        value={citizenIssuePlace}
                        onChange={(e) => setCitizenIssuePlace(e.target.value)}
                        placeholder="VD: Cục CS QLHC về TTXH"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        SDT
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="VD: 0905123456"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Email liên hệ
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="canhan@gmail.com"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Email công ty
                      </label>
                      <input
                        type="email"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        placeholder="ten@11sport.vn"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        ĐỊA CHỈ THƯỜNG CHÚ
                      </label>
                      <input
                        type="text"
                        value={permanentAddress}
                        onChange={(e) => setPermanentAddress(e.target.value)}
                        placeholder="VD: Hải Châu, Đà Nẵng"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        ĐỊA CHỈ HIỆN TẠI
                      </label>
                      <input
                        type="text"
                        value={currentAddress}
                        onChange={(e) => setCurrentAddress(e.target.value)}
                        placeholder="VD: Thanh Khê, Đà Nẵng"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        TRƯỜNG HỌC
                      </label>
                      <input
                        type="text"
                        value={school}
                        onChange={(e) => setSchool(e.target.value)}
                        placeholder="VD: ĐH Kinh tế Đà Nẵng"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        CHUYÊN NGÀNH
                      </label>
                      <input
                        type="text"
                        value={major}
                        onChange={(e) => setMajor(e.target.value)}
                        placeholder="VD: Quản trị kinh doanh"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        VỊ TRÍ
                      </label>
                      <input
                        type="text"
                        value={positionTitle}
                        onChange={(e) => setPositionTitle(e.target.value)}
                        placeholder="VD: Nhân viên bán hàng"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        BỘ PHẬN *
                      </label>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value as "OFFICE" | "SALES")}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-bold"
                      >
                        <option value="SALES">Bán hàng (Showroom)</option>
                        <option value="OFFICE">Văn phòng (Office)</option>
                      </select>
                    </div>
                  </div>

                  {/* Nhóm SỐ HĐ (HDTT / HĐTV / HDXDTH), BHXH (NGÀY ĐÓNG / MỨC ĐÓNG / NGÀY NGHỈ), Lương, Số ngày nghỉ, STK */}
                  <div className="p-3.5 rounded-xl bg-teal-50/40 border border-teal-200/70 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          LOẠI HỢP ĐỒNG *
                        </label>
                        <select
                          required={!isAdminView}
                          value={contractType}
                          onChange={(e) => setContractType(e.target.value as ContractType | "")}
                          className={`w-full px-3 py-2 rounded-lg border text-xs bg-white font-bold ${
                            contractType ? "border-slate-300" : "border-amber-400 text-slate-400"
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
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          SỐ HĐ — HDTT
                        </label>
                        <input
                          type="text"
                          value={internContractNumber}
                          onChange={(e) => setInternContractNumber(e.target.value)}
                          placeholder="Mã HDTT..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          SỐ HĐ — HĐTV
                        </label>
                        <input
                          type="text"
                          value={probationContractNumber}
                          onChange={(e) => setProbationContractNumber(e.target.value)}
                          placeholder="VD: HĐTV-001/2026"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          SỐ HĐ — HDXDTH
                        </label>
                        <input
                          type="text"
                          value={officialContractNumber}
                          onChange={(e) => setOfficialContractNumber(e.target.value)}
                          placeholder="Mã HDXDTH..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          BHXH — NGÀY ĐÓNG
                        </label>
                        <input
                          type="date"
                          value={bhxhStartDate}
                          onChange={(e) => setBhxhStartDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          BHXH — MỨC ĐÓNG
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatMoneyInput(insurance)}
                          onChange={(e) => setInsurance(String(parseMoneyInput(e.target.value) || ""))}
                          placeholder="VD: 5.300.000"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          BHXH — NGÀY NGHỈ
                        </label>
                        <input
                          type="date"
                          value={bhxhEndDate}
                          onChange={(e) => setBhxhEndDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Lương
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatMoneyInput(baseSalary)}
                          onChange={(e) => setBaseSalary(String(parseMoneyInput(e.target.value) || ""))}
                          placeholder="VD: 7.500.000"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Trợ cấp
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatMoneyInput(allowance)}
                          onChange={(e) => setAllowance(String(parseMoneyInput(e.target.value) || ""))}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Thưởng
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatMoneyInput(bonus)}
                          onChange={(e) => setBonus(String(parseMoneyInput(e.target.value) || ""))}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Số ngày nghỉ
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={recordedLeaveDays}
                          onChange={(e) => setRecordedLeaveDays(e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          STK
                        </label>
                        <input
                          type="text"
                          value={bankAccount}
                          onChange={(e) => setBankAccount(e.target.value)}
                          placeholder="VD: 1903686868 - Techcombank"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
