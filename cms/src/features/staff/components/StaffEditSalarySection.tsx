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

export function StaffEditSalarySection({ vm }: { vm: StaffViewModel }) {
  const {
    fullName,
    selectedStaffProfile,
    editFullName,
    editBhxhStart,
    setEditBhxhStart,
    editBhxhEnd,
    setEditBhxhEnd,
    editRecordedLeaveDays,
    setEditRecordedLeaveDays,
    editContractFileUrl,
    setEditContractFileUrl,
    editContractFileName,
    setEditContractFileName,
    editBaseSalary,
    setEditBaseSalary,
    editAllowance,
    setEditAllowance,
    editBonus,
    setEditBonus,
    editInsurance,
    setEditInsurance,
    setPreviewContractStaff,
    setStatusMsg,
    readFileAsDataUrl,
  } = vm;

  return (
    <>
              {/* Khối 3: Lương, BHXH, Số ngày nghỉ & File hợp đồng */}
              <div className="p-4 rounded-2xl bg-teal-50/40 border border-teal-200/80 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-brand-ink">
                  3. Lương, BHXH, Số ngày nghỉ &amp; File Hợp đồng đính kèm
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      BHXH — Ngày đóng
                    </label>
                    <input
                      type="date"
                      value={editBhxhStart}
                      onChange={(e) => setEditBhxhStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      BHXH — Mức đóng (VNĐ)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatMoneyInput(editInsurance)}
                      onChange={(e) => setEditInsurance(parseMoneyInput(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      BHXH — Ngày nghỉ
                    </label>
                    <input
                      type="date"
                      value={editBhxhEnd}
                      onChange={(e) => setEditBhxhEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Số ngày nghỉ (Hồ sơ)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={editRecordedLeaveDays}
                      onChange={(e) => setEditRecordedLeaveDays(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2 flex flex-wrap items-end gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition">
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
                              fullName: editFullName || selectedStaffProfile?.fullName || "",
                              fileName: editContractFileName || "Hop-dong-lao-dong",
                              fileUrl: editContractFileUrl,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-brand-ink" />
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
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa file</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

    </>
  );
}
