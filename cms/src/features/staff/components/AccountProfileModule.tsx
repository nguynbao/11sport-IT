"use client";


import React, { useState, useEffect } from "react";
import { StaffUser, UserRole } from "@/shared/types";
import { apiRequest, getStoredToken, setStoredAuth } from "@/shared/api/client";
import { cleanPhoneDigits, formatPhone } from "@/shared/utils/format";
import {
  User,
  Phone,
  BadgeCheck,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Hash,
  AtSign,
  FileText,
  Eye,
  Mail,
  Building2,
  MapPin,
  CreditCard,
  Briefcase,
  Calendar,
  Wallet,
  Info,
  GraduationCap,
  Landmark,
} from "lucide-react";
import ContractFilePreviewModal from "@/shared/ui/ContractFilePreviewModal";
import { useAccountProfile, getRoleDisplayName, AccountProfileModuleProps } from "../hooks/useAccountProfile";
import { ProfilePersonalCard } from "./ProfilePersonalCard";

export default function AccountProfileModule({ currentUser, onUserUpdated, onBack }: AccountProfileModuleProps) {
  const vm = useAccountProfile({ currentUser, onUserUpdated });
  const {
    fullName,
    phone,
    positionTitle,
    department,
    contractType,
    contractStartDate,
    contractEndDate,
    internContractNumber,
    probationContractNumber,
    officialContractNumber,
    bhxhStartDate,
    bhxhEndDate,
    recordedLeaveDays,
    contractFileUrl,
    contractFileName,
    baseSalary,
    allowance,
    bonus,
    insurance,
    showContractPreview,
    setShowContractPreview,
    contractLabel,
    formatMoney,
  } = vm;

  return (
    <div className="w-full space-y-5">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 text-white rounded-2xl p-5 md:p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 font-black text-2xl shrink-0 shadow-inner">
            {(fullName || currentUser.username || "U").charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg md:text-xl font-extrabold tracking-tight text-white">
                {fullName || currentUser.fullName}
              </h2>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-teal-600 text-white font-bold">
                {getRoleDisplayName(currentUser.role)}
              </span>
              {positionTitle && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-white/15 text-slate-200 font-bold">
                  {positionTitle}
                </span>
              )}
              <span className="inline-flex items-center gap-1 bg-teal-500/15 border border-teal-500/30 text-teal-300 px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                <BadgeCheck className="w-3.5 h-3.5 text-teal-400" />
                Đang hoạt động
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1 font-mono">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                Mã NV: <strong className="text-white">{currentUser.code || "N/A"}</strong>
              </span>
              <span className="inline-flex items-center gap-1 font-mono">
                <AtSign className="w-3.5 h-3.5 text-slate-400" />
                Username: <strong className="text-white">{currentUser.username}</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                Khối:{" "}
                <strong className="text-white">
                  {department === "OFFICE" ? "Văn phòng" : "Bán hàng"}
                </strong>
              </span>
              {phone && (
                <span className="inline-flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <strong className="text-white">{formatPhone(phone)}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="self-start md:self-center px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại làm việc</span>
          </button>
        )}
      </div>

      {/* Bố cục toàn chiều ngang (full-width): Thông tin cá nhân -> Hồ sơ HR -> Quy định */}
      <div className="w-full space-y-5">
      <ProfilePersonalCard vm={vm} />
          {/* Card 2: Hồ sơ Nhân sự, Hợp đồng, BHXH & Chế độ đãi ngộ (Chỉ xem - do HR quản lý) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                    Hồ sơ Công việc, Hợp đồng, BHXH &amp; Chế độ (Chỉ xem)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Các thông tin quản trị nhân sự dưới đây do bộ phận HR cập nhật
                  </p>
                </div>
              </div>
            </div>

            {/* Lưới thông tin công việc & hợp đồng */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Mã nhân viên
                </div>
                <div className="text-sm font-extrabold font-mono text-slate-800 mt-0.5">
                  {currentUser.code || "N/A"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Vị trí (Chức danh)
                </div>
                <div className="text-xs font-bold text-slate-800 mt-1">
                  {positionTitle || getRoleDisplayName(currentUser.role)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Bộ phận / Khối
                </div>
                <div className="text-xs font-bold text-slate-800 mt-1">
                  {department === "OFFICE"
                    ? "Khối Văn phòng (OFFICE)"
                    : "Khối Bán hàng (SALES)"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Loại hợp đồng
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${contractType === "FULLTIME"
                      ? "bg-teal-100 text-brand-ink"
                      : contractType === "INTERN"
                        ? "bg-teal-100 text-brand-ink"
                        : "bg-amber-100 text-amber-800"
                      }`}
                  >
                    {contractLabel}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Thời hạn hợp đồng
                </div>
                <div className="text-xs font-mono font-bold text-slate-800 mt-1">
                  {contractStartDate
                    ? `${contractStartDate}${contractEndDate ? ` → ${contractEndDate}` : ""}`
                    : "Chưa cập nhật"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Số ngày nghỉ hồ sơ
                </div>
                <div className="text-xs font-mono font-bold text-slate-800 mt-1">
                  {recordedLeaveDays} ngày
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Số HĐ Thực tập (HDTT)
                </div>
                <div className="text-xs font-mono font-bold text-slate-800 mt-1">
                  {internContractNumber || "—"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Số HĐ Thử việc (HĐTV)
                </div>
                <div className="text-xs font-mono font-bold text-slate-800 mt-1">
                  {probationContractNumber || "—"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Số HĐ Chính thức (HDXDTH)
                </div>
                <div className="text-xs font-mono font-bold text-slate-800 mt-1">
                  {officialContractNumber || "—"}
                </div>
              </div>
            </div>

            {/* Chế độ Lương, Trợ cấp, Thưởng & BHXH */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase">
                <Wallet className="w-3.5 h-3.5 text-brand-ink" />
                <span>Chế độ Lương, Trợ cấp, Thưởng &amp; BHXH</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    Lương cơ bản
                  </div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 mt-1">
                    {formatMoney(baseSalary)}{" "}
                    <span className="text-[10px] font-normal text-slate-500">đ</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    Trợ cấp
                  </div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 mt-1">
                    {formatMoney(allowance)}{" "}
                    <span className="text-[10px] font-normal text-slate-500">đ</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    Thưởng
                  </div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 mt-1">
                    {formatMoney(bonus)}{" "}
                    <span className="text-[10px] font-normal text-slate-500">đ</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    BHXH — Ngày đóng
                  </div>
                  <div className="text-xs font-bold font-mono text-slate-900 mt-1">
                    {bhxhStartDate || "—"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    BHXH — Mức đóng
                  </div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 mt-1">
                    {formatMoney(insurance)}{" "}
                    <span className="text-[10px] font-normal text-slate-500">đ</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    BHXH — Ngày nghỉ
                  </div>
                  <div className="text-xs font-bold font-mono text-slate-900 mt-1">
                    {bhxhEndDate || "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* File hợp đồng lao động (Chỉ xem) */}
            <div className="pt-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                File hợp đồng lao động (Chỉ xem)
              </label>
              {contractFileUrl ? (
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-xl border border-teal-200 bg-teal-50/70">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-brand-ink shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {contractFileName || "Hop-dong-lao-dong"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowContractPreview(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem hợp đồng</span>
                  </button>
                </div>
              ) : (
                <div className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs italic">
                  Chưa có file hợp đồng đính kèm (Do bộ phận Nhân sự HR cập nhật)
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Quyền lợi hợp đồng & Lưu ý nhân sự */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase">
              <Info className="w-4 h-4 text-brand-ink shrink-0" />
              <span>Quyền lợi &amp; Quy định Hồ sơ Nhân sự</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Chế độ phép có lương:</strong>{" "}
                  {contractType === "FULLTIME"
                    ? "Bạn đang là nhân viên Chính thức — được hưởng 1 ngày nghỉ phép có lương mỗi tháng."
                    : "Chỉ áp dụng 1 ngày phép có lương/tháng đối với nhân viên Hợp đồng Chính thức."}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Thông tin cá nhân &amp; Ngân hàng:</strong> Nhân viên chủ động cập nhật
                  Họ tên, Ngày sinh, Giới tính, SĐT, Email, CCCD (Ngày cấp / Nơi cấp), Địa chỉ thường trú &amp; hiện tại, Trường học, Chuyên ngành và STK ngân hàng.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Chế độ Lương, BHXH &amp; Hợp đồng:</strong> Vị trí, Số HĐ, BHXH, Lương cơ bản, Trợ
                  cấp, Thưởng và File hợp đồng do bộ phận <strong>Nhân sự (HR)</strong> cập nhật.
                </span>
              </li>
            </ul>
          </div>
      </div>

      {/* Modal Xem trước / Tải về File Hợp đồng */}
      {showContractPreview && contractFileUrl && (
        <ContractFilePreviewModal
          staffName={fullName || currentUser.fullName}
          fileName={contractFileName || "Hop-dong-lao-dong"}
          fileUrl={contractFileUrl}
          onClose={() => setShowContractPreview(false)}
        />
      )}
    </div>
  );
}

