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
import { AccountProfileViewModel } from "../hooks/useAccountProfile";

export function ProfilePersonalCard({ vm }: { vm: AccountProfileViewModel }) {
  const {
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
    bankAccount,
    setBankAccount,
    savingProfile,
    profileMsg,
    handleSaveProfile,
  } = vm;

  return (
    <>
          {/* Card 1: Thông tin cá nhân, Học vấn & Ngân hàng (Cho phép chỉnh sửa) */}
          <form
            onSubmit={handleSaveProfile}
            className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-brand-ink flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                    Thông tin cá nhân, CCCD, Học vấn &amp; Ngân hàng
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Bạn có thể chủ động cập nhật các thông tin cá nhân &amp; STK nhận lương dưới đây
                  </p>
                </div>
              </div>
            </div>

            {profileMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 border ${profileMsg.type === "success"
                  ? "bg-teal-50 border-teal-200 text-brand-ink"
                  : "bg-red-50 border-red-200 text-red-700"
                  }`}
              >
                {profileMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
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
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Giới tính
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:border-teal-600 focus:outline-none"
                  >
                    <option value="">-- Chọn --</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Quốc tịch
                  </label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="Việt Nam"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Email liên hệ
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="VD: ca_nhan@gmail.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Email công ty
                </label>
                <div className="relative">
                  <AtSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="VD: nhanvien@11sport.vn"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Số CCCD / CMND
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={citizenId}
                    onChange={(e) => setCitizenId(e.target.value)}
                    placeholder="Số CCCD 12 số..."
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Ngày cấp
                  </label>
                  <input
                    type="date"
                    value={citizenIssueDate}
                    onChange={(e) => setCitizenIssueDate(e.target.value)}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Nơi cấp
                  </label>
                  <input
                    type="text"
                    value={citizenIssuePlace}
                    onChange={(e) => setCitizenIssuePlace(e.target.value)}
                    placeholder="Cục CS QLHC..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Địa chỉ thường trú
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={permanentAddress}
                    onChange={(e) => setPermanentAddress(e.target.value)}
                    placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành..."
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Địa chỉ hiện tại
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={currentAddress}
                    onChange={(e) => setCurrentAddress(e.target.value)}
                    placeholder="Chỗ ở hiện tại..."
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Trường học
                </label>
                <div className="relative">
                  <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="VD: ĐH Kinh tế Đà Nẵng"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Chuyên ngành
                </label>
                <input
                  type="text"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="VD: Quản trị kinh doanh"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Số tài khoản ngân hàng (STK nhận lương)
                </label>
                <div className="relative">
                  <Landmark className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="VD: 1903686868 - Techcombank"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {savingProfile ? "Đang lưu thay đổi..." : "Lưu thông tin cá nhân"}
                </span>
              </button>
            </div>
          </form>

    </>
  );
}
