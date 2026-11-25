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

export function StaffPasswordModal({ vm }: { vm: StaffViewModel }) {
  const {
    username,
    password,
    fullName,
    role,
    pwdTargetStaff,
    setPwdTargetStaff,
    newStaffPassword,
    setNewStaffPassword,
    confirmStaffPassword,
    setConfirmStaffPassword,
    pwdSaving,
    handleResetStaffPassword,
  } = vm;

  return (
    <>
      {/* Modal Đổi mật khẩu cho nhân viên */}
      {pwdTargetStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-teal-400" />
                <h4 className="font-extrabold text-sm">
                  Đổi mật khẩu tài khoản: {pwdTargetStaff.username}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPwdTargetStaff(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-teal-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetStaffPassword} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>
                  Nhân sự: <strong className="text-slate-900">{pwdTargetStaff.fullName}</strong>
                </div>
                <div>
                  Username: <span className="font-mono font-bold">{pwdTargetStaff.username}</span> · Vai trò:{" "}
                  <span className="font-mono font-bold text-brand-ink">{pwdTargetStaff.role}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mật khẩu mới (Tối thiểu 4 ký tự) *
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={confirmStaffPassword}
                  onChange={(e) => setConfirmStaffPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPwdTargetStaff(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-bold shadow"
                >
                  {pwdSaving ? "Đang lưu..." : "Lưu mật khẩu mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}
