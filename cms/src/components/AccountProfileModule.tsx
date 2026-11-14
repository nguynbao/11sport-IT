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
import ContractFilePreviewModal from "./ContractFilePreviewModal";

function getRoleDisplayName(role?: UserRole): string {
  switch (role) {
    case "CEO":
      return "Giám đốc (CEO)";
    case "ADMIN":
      return "Quản lý (ADMIN)";
    case "HR":
      return "Nhân sự (HR)";
    case "ACCOUNTANT":
      return "Kế toán & Kho (ACCOUNTANT)";
    case "MARKETING":
      return "Marketing (MARKETING)";
    case "SALES":
      return "NV Bán hàng (SALES)";
    default:
      return role || "Nhân sự";
  }
}

function toIsoDateSlice(val?: string | null): string {
  if (!val) return "";
  return String(val).slice(0, 10);
}

interface AccountProfileModuleProps {
  currentUser: StaffUser;
  onUserUpdated: (updated: StaffUser) => void;
  onBack?: () => void;
}

export default function AccountProfileModule({
  currentUser,
  onUserUpdated,
  onBack,
}: AccountProfileModuleProps) {
  // Các trường nhân viên được phép tự cập nhật
  const [fullName, setFullName] = useState(currentUser.fullName || "");
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [email, setEmail] = useState(currentUser.email || "");
  const [companyEmail, setCompanyEmail] = useState(currentUser.companyEmail || "");
  const [dateOfBirth, setDateOfBirth] = useState(toIsoDateSlice(currentUser.dateOfBirth));
  const [gender, setGender] = useState(currentUser.gender || "");
  const [nationality, setNationality] = useState(currentUser.nationality || "Việt Nam");
  const [citizenId, setCitizenId] = useState(currentUser.citizenId || "");
  const [citizenIssueDate, setCitizenIssueDate] = useState(
    toIsoDateSlice(currentUser.citizenIssueDate)
  );
  const [citizenIssuePlace, setCitizenIssuePlace] = useState(
    currentUser.citizenIssuePlace || ""
  );
  const [permanentAddress, setPermanentAddress] = useState(
    currentUser.permanentAddress || currentUser.address || ""
  );
  const [currentAddress, setCurrentAddress] = useState(
    currentUser.currentAddress || ""
  );
  const [school, setSchool] = useState(currentUser.school || "");
  const [major, setMajor] = useState(currentUser.major || "");
  const [bankAccount, setBankAccount] = useState(currentUser.bankAccount || "");

  // Các trường chỉ xem (do HR quản lý)
  const [positionTitle, setPositionTitle] = useState(currentUser.positionTitle || "");
  const [department, setDepartment] = useState(
    currentUser.department || (currentUser.role === "SALES" ? "SALES" : "OFFICE")
  );
  const [contractType, setContractType] = useState(currentUser.contractType || "");
  const [contractStartDate, setContractStartDate] = useState(
    toIsoDateSlice(currentUser.contractStartDate)
  );
  const [contractEndDate, setContractEndDate] = useState(
    toIsoDateSlice(currentUser.contractEndDate)
  );
  const [internContractNumber, setInternContractNumber] = useState(
    currentUser.internContractNumber || ""
  );
  const [probationContractNumber, setProbationContractNumber] = useState(
    currentUser.probationContractNumber || ""
  );
  const [officialContractNumber, setOfficialContractNumber] = useState(
    currentUser.officialContractNumber || ""
  );
  const [bhxhStartDate, setBhxhStartDate] = useState(
    toIsoDateSlice(currentUser.bhxhStartDate)
  );
  const [bhxhEndDate, setBhxhEndDate] = useState(
    toIsoDateSlice(currentUser.bhxhEndDate)
  );
  const [recordedLeaveDays, setRecordedLeaveDays] = useState<number>(
    Number(currentUser.recordedLeaveDays || 0)
  );
  const [contractFileUrl, setContractFileUrl] = useState(
    currentUser.contractFileUrl || ""
  );
  const [contractFileName, setContractFileName] = useState(
    currentUser.contractFileName || ""
  );
  const [baseSalary, setBaseSalary] = useState<number>(
    Number(currentUser.baseSalary || 0)
  );
  const [allowance, setAllowance] = useState<number>(
    Number(currentUser.allowance || 0)
  );
  const [bonus, setBonus] = useState<number>(Number(currentUser.bonus || 0));
  const [insurance, setInsurance] = useState<number>(
    Number(currentUser.insurance || 0)
  );

  const [showContractPreview, setShowContractPreview] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{
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
          setEmail(found.email || "");
          setCompanyEmail(found.companyEmail || "");
          setDateOfBirth(toIsoDateSlice(found.dateOfBirth));
          setGender(found.gender || "");
          setNationality(found.nationality || "Việt Nam");
          setCitizenId(found.citizenId || "");
          setCitizenIssueDate(toIsoDateSlice(found.citizenIssueDate));
          setCitizenIssuePlace(found.citizenIssuePlace || "");
          setPermanentAddress(found.permanentAddress || found.address || "");
          setCurrentAddress(found.currentAddress || "");
          setSchool(found.school || "");
          setMajor(found.major || "");
          setBankAccount(found.bankAccount || "");

          setPositionTitle(found.positionTitle || "");
          setDepartment(
            found.department || (found.role === "SALES" ? "SALES" : "OFFICE")
          );
          setContractType(found.contractType || "");
          setContractStartDate(toIsoDateSlice(found.contractStartDate));
          setContractEndDate(toIsoDateSlice(found.contractEndDate));
          setInternContractNumber(found.internContractNumber || "");
          setProbationContractNumber(found.probationContractNumber || "");
          setOfficialContractNumber(found.officialContractNumber || "");
          setBhxhStartDate(toIsoDateSlice(found.bhxhStartDate));
          setBhxhEndDate(toIsoDateSlice(found.bhxhEndDate));
          setRecordedLeaveDays(Number(found.recordedLeaveDays || 0));
          setContractFileUrl(found.contractFileUrl || "");
          setContractFileName(found.contractFileName || "");
          setBaseSalary(Number(found.baseSalary || 0));
          setAllowance(Number(found.allowance || 0));
          setBonus(Number(found.bonus || 0));
          setInsurance(Number(found.insurance || 0));

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
    const cleanEmail = email.trim();
    const cleanCompanyEmail = companyEmail.trim();
    const cleanCitizenId = citizenId.trim();
    const cleanPerm = permanentAddress.trim();
    const cleanCurr = currentAddress.trim();

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
          email: cleanEmail,
          companyEmail: cleanCompanyEmail,
          dateOfBirth: dateOfBirth || null,
          gender: gender.trim(),
          nationality: nationality.trim(),
          citizenId: cleanCitizenId,
          citizenIssueDate: citizenIssueDate || null,
          citizenIssuePlace: citizenIssuePlace.trim(),
          permanentAddress: cleanPerm,
          currentAddress: cleanCurr,
          address: cleanPerm || cleanCurr,
          school: school.trim(),
          major: major.trim(),
          bankAccount: bankAccount.trim(),
        }),
      });

      const updatedUser: StaffUser = {
        ...currentUser,
        ...(res.data || {}),
        fullName: res.data?.fullName || cleanName,
        phone: res.data?.phone !== undefined ? res.data.phone : cleanPhone,
        email: res.data?.email !== undefined ? res.data.email : cleanEmail,
        companyEmail:
          res.data?.companyEmail !== undefined
            ? res.data.companyEmail
            : cleanCompanyEmail,
        citizenId:
          res.data?.citizenId !== undefined ? res.data.citizenId : cleanCitizenId,
        permanentAddress:
          res.data?.permanentAddress !== undefined
            ? res.data.permanentAddress
            : cleanPerm,
        currentAddress:
          res.data?.currentAddress !== undefined
            ? res.data.currentAddress
            : cleanCurr,
        address:
          res.data?.address !== undefined
            ? res.data.address
            : cleanPerm || cleanCurr,
      };

      const token = getStoredToken();
      if (token) {
        setStoredAuth(token, updatedUser);
      }
      onUserUpdated(updatedUser);

      setProfileMsg({
        type: "success",
        text: "Đã cập nhật hồ sơ cá nhân thành công!",
      });
    } catch (err: any) {
      setProfileMsg({
        type: "error",
        text:
          err?.message ||
          "Không thể cập nhật thông tin cá nhân. Vui lòng thử lại.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const contractLabel =
    contractType === "FULLTIME"
      ? "Chính thức"
      : contractType === "PROBATION"
        ? "Thử việc"
        : contractType === "INTERN"
          ? "Thực tập (Intern)"
          : contractType === "PARTTIME"
            ? "Bán thời gian (cũ)"
            : "Chưa cập nhật";

  const formatMoney = (val: number) =>
    new Intl.NumberFormat("vi-VN").format(Number(val || 0));

  return (
    <div className="w-full space-y-5">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 text-white rounded-2xl p-5 md:p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-2xl shrink-0 shadow-inner">
            {(fullName || currentUser.username || "U").charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg md:text-xl font-extrabold tracking-tight text-white">
                {fullName || currentUser.fullName}
              </h2>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-bold">
                {getRoleDisplayName(currentUser.role)}
              </span>
              {positionTitle && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-white/15 text-slate-200 font-bold">
                  {positionTitle}
                </span>
              )}
              <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
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
          {/* Card 1: Thông tin cá nhân, Học vấn & Ngân hàng (Cho phép chỉnh sửa) */}
          <form
            onSubmit={handleSaveProfile}
            className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
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
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
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
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-emerald-600 focus:outline-none"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-emerald-600 focus:outline-none"
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
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:border-emerald-600 focus:outline-none"
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
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
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
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
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
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
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
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-emerald-600 focus:outline-none"
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
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:border-emerald-600 focus:outline-none"
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
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-emerald-600 focus:outline-none"
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
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
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
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
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
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
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
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {savingProfile ? "Đang lưu thay đổi..." : "Lưu thông tin cá nhân"}
                </span>
              </button>
            </div>
          </form>

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
                      ? "bg-emerald-100 text-emerald-800"
                      : contractType === "INTERN"
                        ? "bg-sky-100 text-sky-800"
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
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
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
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50/70">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {contractFileName || "Hop-dong-lao-dong"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowContractPreview(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
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
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Quyền lợi &amp; Quy định Hồ sơ Nhân sự</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Chế độ phép có lương:</strong>{" "}
                  {contractType === "FULLTIME"
                    ? "Bạn đang là nhân viên Chính thức — được hưởng 1 ngày nghỉ phép có lương mỗi tháng."
                    : "Chỉ áp dụng 1 ngày phép có lương/tháng đối với nhân viên Hợp đồng Chính thức."}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Thông tin cá nhân &amp; Ngân hàng:</strong> Nhân viên chủ động cập nhật
                  Họ tên, Ngày sinh, Giới tính, SĐT, Email, CCCD (Ngày cấp / Nơi cấp), Địa chỉ thường trú &amp; hiện tại, Trường học, Chuyên ngành và STK ngân hàng.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
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
