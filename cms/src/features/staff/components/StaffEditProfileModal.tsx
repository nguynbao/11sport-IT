"use client";


import { ContractType } from "@/shared/types";
import { CONTRACT_TYPE_OPTIONS } from "@/shared/utils/format";
import {
Save,
X
} from "lucide-react";
import { StaffViewModel } from "../hooks/useStaffModule";
import { StaffEditSalarySection } from "./StaffEditSalarySection";

export function StaffEditProfileModal({ vm }: { vm: StaffViewModel }) {
  const {
    username,
    fullName,
    email,
    contractType,
    selectedStaffProfile,
    setSelectedStaffProfile,
    editFullName,
    setEditFullName,
    editPhone,
    setEditPhone,
    editEmail,
    setEditEmail,
    editCompanyEmail,
    setEditCompanyEmail,
    editDateOfBirth,
    setEditDateOfBirth,
    editGender,
    setEditGender,
    editNationality,
    setEditNationality,
    editCitizenId,
    setEditCitizenId,
    editCitizenIssueDate,
    setEditCitizenIssueDate,
    editCitizenIssuePlace,
    setEditCitizenIssuePlace,
    editPermanentAddress,
    setEditPermanentAddress,
    editCurrentAddress,
    setEditCurrentAddress,
    editSchool,
    setEditSchool,
    editMajor,
    setEditMajor,
    editPositionTitle,
    setEditPositionTitle,
    editBankAccount,
    setEditBankAccount,
    editDepartment,
    setEditDepartment,
    editContractType,
    setEditContractType,
    editProbationMonths,
    setEditProbationMonths,
    editContractStart,
    setEditContractStart,
    editContractEnd,
    setEditContractEnd,
    editInternContractNo,
    setEditInternContractNo,
    editProbationContractNo,
    setEditProbationContractNo,
    editOfficialContractNo,
    setEditOfficialContractNo,
    profileSaving,
    handleSaveProfileModal,
  } = vm;

  return (
    <>
      {/* Modal Chỉnh Sửa Chi Tiết Hồ Sơ Nhân Sự (Dành cho HR) */}
      {selectedStaffProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <span className="text-xs uppercase font-bold text-teal-400 tracking-wider">
                  Chỉnh Sửa Hồ Sơ Nhân Sự ({selectedStaffProfile.code})
                </span>
                <h3 className="font-extrabold text-base text-white mt-0.5">
                  @{selectedStaffProfile.username} — {selectedStaffProfile.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffProfile(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-teal-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfileModal} className="p-6 space-y-5 text-xs overflow-y-auto">
              {/* Khối 1: Thông tin Cá nhân, CCCD & Học vấn */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  1. Thông tin Cá nhân, CCCD, Địa chỉ &amp; Học vấn
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Họ và tên nhân viên *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Ngày sinh</label>
                    <input
                      type="date"
                      value={editDateOfBirth}
                      onChange={(e) => setEditDateOfBirth(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Giới tính</label>
                      <select
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                      >
                        <option value="">-- Chọn --</option>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Quốc tịch</label>
                      <input
                        type="text"
                        value={editNationality}
                        onChange={(e) => setEditNationality(e.target.value)}
                        placeholder="Việt Nam"
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">CMND / CCCD</label>
                    <input
                      type="text"
                      value={editCitizenId}
                      onChange={(e) => setEditCitizenId(e.target.value)}
                      placeholder="Số CCCD 12 số..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Ngày cấp CCCD</label>
                    <input
                      type="date"
                      value={editCitizenIssueDate}
                      onChange={(e) => setEditCitizenIssueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nơi cấp CCCD</label>
                    <input
                      type="text"
                      value={editCitizenIssuePlace}
                      onChange={(e) => setEditCitizenIssuePlace(e.target.value)}
                      placeholder="Cục CS QLHC..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Số điện thoại</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Email liên hệ</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Email công ty</label>
                    <input
                      type="email"
                      value={editCompanyEmail}
                      onChange={(e) => setEditCompanyEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Địa chỉ thường trú
                      </label>
                      <input
                        type="text"
                        value={editPermanentAddress}
                        onChange={(e) => setEditPermanentAddress(e.target.value)}
                        placeholder="Nhập hộ khẩu / địa chỉ thường trú..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Địa chỉ hiện tại
                      </label>
                      <input
                        type="text"
                        value={editCurrentAddress}
                        onChange={(e) => setEditCurrentAddress(e.target.value)}
                        placeholder="Nhập chỗ ở hiện tại..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Trường học</label>
                    <input
                      type="text"
                      value={editSchool}
                      onChange={(e) => setEditSchool(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Chuyên ngành</label>
                    <input
                      type="text"
                      value={editMajor}
                      onChange={(e) => setEditMajor(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Số tài khoản ngân hàng (STK)
                    </label>
                    <input
                      type="text"
                      value={editBankAccount}
                      onChange={(e) => setEditBankAccount(e.target.value)}
                      placeholder="VD: 1903686868 - Techcombank"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Khối 2: Vị trí, Hợp đồng & Số HĐ */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  2. Vị trí, Hợp đồng Lao động &amp; Số Hợp đồng (HDTT / HĐTV / HDXDTH)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Vị trí (Chức danh)
                    </label>
                    <input
                      type="text"
                      value={editPositionTitle}
                      onChange={(e) => setEditPositionTitle(e.target.value)}
                      placeholder="VD: Nhân viên bán hàng"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Bộ phận (Khối)
                    </label>
                    <select
                      value={editDepartment}
                      onChange={(e) => setEditDepartment(e.target.value as "OFFICE" | "SALES")}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs"
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs"
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
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs"
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Số HĐ Thực tập (HDTT)
                    </label>
                    <input
                      type="text"
                      value={editInternContractNo}
                      onChange={(e) => setEditInternContractNo(e.target.value)}
                      placeholder="Mã HDTT..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Số HĐ Thử việc (HĐTV)
                    </label>
                    <input
                      type="text"
                      value={editProbationContractNo}
                      onChange={(e) => setEditProbationContractNo(e.target.value)}
                      placeholder="Mã HĐTV..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Số HĐ Chính thức (HDXDTH)
                    </label>
                    <input
                      type="text"
                      value={editOfficialContractNo}
                      onChange={(e) => setEditOfficialContractNo(e.target.value)}
                      placeholder="Mã HDXDTH..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

      <StaffEditSalarySection vm={vm} />
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStaffProfile(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {profileSaving ? "Đang lưu..." : "Lưu thông tin nhân sự"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}

