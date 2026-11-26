import React from "react";
import { FileText, Eye, Briefcase, Calendar, Wallet } from "lucide-react";
import { formatMoney, getContractLabel } from "../utils/accountProfile";
import type { AccountProfileState } from "../hooks/useAccountProfile";
import type { StaffUser, UserRole } from "@/shared/types";

export default function AccountHrSection({ p, currentUser, getRoleDisplayName }: { p: AccountProfileState; currentUser: StaffUser; getRoleDisplayName: (role?: UserRole) => string }) {
  const { positionTitle, department, contractType, contractStartDate, contractEndDate, internContractNumber, probationContractNumber, officialContractNumber, bhxhStartDate, bhxhEndDate, recordedLeaveDays, contractFileUrl, contractFileName, baseSalary, allowance, bonus, insurance, setShowContractPreview } = p;
  return (
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
                        ? "bg-blue-100 text-brand-ink"
                        : contractType === "INTERN"
                          ? "bg-blue-100 text-brand-ink"
                          : "bg-amber-100 text-amber-800"
                      }`}
                  >
                    {getContractLabel(contractType)}
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
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/70">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-brand-ink shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {contractFileName || "Hop-dong-lao-dong"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowContractPreview(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
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

  );
}
