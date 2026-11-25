"use client";


import { ContractType } from "@/shared/types";
import { CONTRACT_TYPE_OPTIONS } from "@/shared/utils/format";
import {
ChevronDown,
ChevronUp
} from "lucide-react";
import { StaffViewModel } from "../hooks/useStaffModule";
import { formatMoneyInput,parseMoneyInput } from "../utils";

export function StaffCreateHrFields({ vm }: { vm: StaffViewModel }) {
  const {
    isAdminView,
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
  } = vm;

  return (
    <>
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

    </>
  );
}
