"use client";

import { contractTypeLabel,formatVND } from "@/shared/utils/format";
import {
AlertCircle,
CheckSquare,
FileSpreadsheet,
Loader2,
Square,
X
} from "lucide-react";
import { StaffViewModel } from "../hooks/useStaffModule";

export function StaffImportPreviewModal({ vm }: { vm: StaffViewModel }) {
  const {
    fullName,
    phone,
    dateOfBirth,
    gender,
    nationality,
    citizenId,
    citizenIssueDate,
    citizenIssuePlace,
    permanentAddress,
    currentAddress,
    school,
    major,
    positionTitle,
    bankAccount,
    role,
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
    baseSalary,
    insurance,
    importModalOpen,
    setImportModalOpen,
    importFileName,
    importRows,
    setImportRows,
    bulkPassword,
    setBulkPassword,
    bulkCreating,
    importModalError,
    setStatusMsg,
    fillCreateFormFromImportRow,
    handleBulkCreateFromModal,
    allModalSelected,
    selectedModalCount,
  } = vm;

  return (
    <>
      {/* Modal Xem trước & Chọn dòng khi file Excel có nhiều nhân viên */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4">
          <div className="w-full max-w-6xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <div className="text-xs uppercase font-bold text-teal-400 tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Import Nhanh Hồ Sơ Nhân Sự Từ Excel</span>
                </div>
                <h3 className="font-extrabold text-base text-white mt-0.5">
                  File: {importFileName} — Đọc được {importRows.length} nhân sự
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-teal-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-slate-600">
                  Bấm <strong className="text-brand-ink">&ldquo;Điền vào form&rdquo;</strong> ở 1 dòng để đưa thông tin ra ngoài kiểm tra kỹ trước khi tạo, hoặc tích chọn nhiều dòng để{" "}
                  <strong className="text-slate-900">Tạo hàng loạt</strong>.
                </div>
                <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700">Mật khẩu mặc định khi tạo loạt:</label>
                  <input
                    type="text"
                    value={bulkPassword}
                    onChange={(e) => setBulkPassword(e.target.value)}
                    className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-xs"
                  />
                </div>
              </div>

              {importModalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{importModalError}</span>
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                    <tr className="border-b border-slate-200">
                      <th rowSpan={2} className="py-2 px-3 w-10 border-r border-slate-200">
                        <button
                          type="button"
                          onClick={() =>
                            setImportRows((prev) =>
                              prev.map((r) => ({ ...r, selected: !allModalSelected }))
                            )
                          }
                          className="text-slate-700 hover:text-brand-ink cursor-pointer"
                          title="Chọn / Bỏ chọn tất cả"
                        >
                          {allModalSelected ? (
                            <CheckSquare className="w-4 h-4 text-brand-ink" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">Username *</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">BẮT ĐẦU</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">KẾT THÚC</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">HỌ TÊN</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">NGÀY SINH</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">GIỚI TÍNH</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">QUỐC TỊCH</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">CMND</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">NGÀY CẤP</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">NƠI CẤP</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">ĐỊA CHỈ THƯỜNG CHÚ</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">ĐỊA CHỈ HIỆN TẠI</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">TRƯỜNG HỌC</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">CHUYÊN NGÀNH</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">VỊ TRÍ</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">LOẠI HỢP ĐỒNG</th>
                      <th colSpan={3} className="py-1.5 px-3 text-center border-r border-b border-slate-200 bg-slate-200/60">
                        SỐ HĐ
                      </th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">SDT</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">BỘ PHẬN</th>
                      <th colSpan={3} className="py-1.5 px-3 text-center border-r border-b border-slate-200 bg-slate-200/60">
                        BHXH
                      </th>
                      <th rowSpan={2} className="py-2 px-3 text-right border-r border-slate-200">Lương</th>
                      <th rowSpan={2} className="py-2 px-3 text-center border-r border-slate-200">Số ngày nghỉ</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">STK</th>
                      <th rowSpan={2} className="py-2 px-3 text-right">Thao tác</th>
                    </tr>
                    <tr>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-[10px]">HDTT</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-[10px]">HĐTV</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-[10px]">HDXDTH</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-[10px]">NGÀY ĐÓNG</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-[10px] text-right">MỨC ĐÓNG</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-[10px]">NGÀY NGHỈ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {importRows.map((r, idx) => (
                      <tr key={r.rowIndex} className={r.selected ? "bg-white" : "bg-slate-50/60 text-slate-400"}>
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={r.selected}
                            onChange={(e) =>
                              setImportRows((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, selected: e.target.checked } : item
                                )
                              )
                            }
                            className="w-4 h-4 accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={r.usernameInput}
                            onChange={(e) =>
                              setImportRows((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, usernameInput: e.target.value } : item
                                )
                              )
                            }
                            className="w-28 px-2 py-1 rounded border border-slate-300 font-mono text-xs bg-white text-slate-900"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono">{r.contractStartDate || "—"}</td>
                        <td className="py-2.5 px-3 font-mono">{r.contractEndDate || "—"}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{r.fullName}</td>
                        <td className="py-2.5 px-3 font-mono">{r.dateOfBirth || "—"}</td>
                        <td className="py-2.5 px-3">{r.gender || "—"}</td>
                        <td className="py-2.5 px-3">{r.nationality || "Việt Nam"}</td>
                        <td className="py-2.5 px-3 font-mono">{r.citizenId || "—"}</td>
                        <td className="py-2.5 px-3 font-mono">{r.citizenIssueDate || "—"}</td>
                        <td className="py-2.5 px-3">{r.citizenIssuePlace || "—"}</td>
                        <td className="py-2.5 px-3 max-w-[180px] truncate" title={r.permanentAddress}>
                          {r.permanentAddress || "—"}
                        </td>
                        <td className="py-2.5 px-3 max-w-[180px] truncate" title={r.currentAddress}>
                          {r.currentAddress || "—"}
                        </td>
                        <td className="py-2.5 px-3">{r.school || "—"}</td>
                        <td className="py-2.5 px-3">{r.major || "—"}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{r.positionTitle || r.role}</td>
                        <td className="py-2.5 px-3 font-bold text-brand-ink">{contractTypeLabel(r.contractType)}</td>
                        <td className="py-2.5 px-2.5 font-mono">{r.internContractNumber || "—"}</td>
                        <td className="py-2.5 px-2.5 font-mono">{r.probationContractNumber || "—"}</td>
                        <td className="py-2.5 px-2.5 font-mono">{r.officialContractNumber || "—"}</td>
                        <td className="py-2.5 px-3 font-mono">{r.phone || "—"}</td>
                        <td className="py-2.5 px-3">
                          {r.department === "OFFICE" ? "Văn phòng" : "Bán hàng"} ({r.role})
                        </td>
                        <td className="py-2.5 px-2.5 font-mono">{r.bhxhStartDate || "—"}</td>
                        <td className="py-2.5 px-2.5 text-right font-mono">
                          {r.insurance > 0 ? formatVND(r.insurance) : "—"}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono">{r.bhxhEndDate || "—"}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {r.baseSalary ? formatVND(r.baseSalary) : "0đ"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">{r.recordedLeaveDays ?? 0}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]" title={r.bankAccount}>
                          {r.bankAccount || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              fillCreateFormFromImportRow(r, r.usernameInput);
                              setImportModalOpen(false);
                              setStatusMsg({
                                type: "success",
                                text: `Đã điền hồ sơ "${r.fullName}" vào form. Kiểm tra lại và bấm "+ Tạo Nhân Viên Mới"!`,
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-brand-ink border border-teal-200 font-bold text-xs cursor-pointer"
                          >
                            Điền vào form
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs font-bold text-slate-600">
                Đã chọn: <strong className="text-brand-ink">{selectedModalCount}</strong> / {importRows.length} nhân sự
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={bulkCreating || selectedModalCount === 0}
                  onClick={handleBulkCreateFromModal}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-bold shadow inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {bulkCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {bulkCreating
                      ? "Đang tạo tài khoản..."
                      : `Tạo hàng loạt (${selectedModalCount} nhân viên)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
