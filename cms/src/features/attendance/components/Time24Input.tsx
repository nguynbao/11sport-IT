"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TimesheetData, TimesheetRow, TimesheetCell, TimesheetCellCode, TimesheetDay, Department } from "@/shared/types";
import { fetchTimesheetApi, adjustAttendanceApi, createManualAttendanceApi } from "../api";
import { buildSheet, downloadExcel, excelFileName, ExcelColumn } from "@/shared/lib/excel";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Users,
  AlertTriangle,
  UserX,
  LogOut,
  Activity,
  CheckCircle2,
  X,
  Pencil,
  Plus,
  LayoutGrid,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import {
  CELL_STYLE,
  WEEKDAY_SHORT,
  ViewMode,
  IssueFilter,
  EditTarget,
  formatMinutes,
  hasIssue,
  SHIFT_DEFAULT_TIMES,
  HOURS_24,
  MINUTES_60,
} from "../timesheet.constants";

export function Time24Input({
  value,
  onChange,
  allowEmpty = false,
}: {
  value: string;
  onChange: (val: string) => void;
  allowEmpty?: boolean;
}) {
  const parts = /^(\d{1,2}):(\d{2})$/.exec((value || "").trim());
  const hh = parts ? String(Math.min(23, Math.max(0, Number(parts[1])))).padStart(2, "0") : "";
  const mm = parts ? String(Math.min(59, Math.max(0, Number(parts[2])))).padStart(2, "0") : "";

  return (
    <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-xl p-1 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 focus-within:bg-white transition">
      <div className="relative">
        <select
          value={hh}
          onChange={(e) => {
            const nextH = e.target.value;
            if (!nextH) {
              onChange("");
            } else {
              onChange(`${nextH}:${mm || "00"}`);
            }
          }}
          className="appearance-none w-full bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg pl-3 pr-7 py-1.5 text-center text-sm font-mono font-bold text-slate-900 outline-none cursor-pointer transition"
          aria-label="Giờ (00-23)"
        >
          {allowEmpty && <option value="">--h</option>}
          {HOURS_24.map((h) => (
            <option key={h} value={h}>
              {h}h
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
      </div>
      <span className="text-slate-400 font-mono font-bold text-sm select-none px-0.5">:</span>
      <div className="relative">
        <select
          value={hh ? mm || "00" : ""}
          disabled={!hh && allowEmpty}
          onChange={(e) => {
            const nextM = e.target.value || "00";
            onChange(`${hh || "08"}:${nextM}`);
          }}
          className="appearance-none w-full bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg pl-3 pr-7 py-1.5 text-center text-sm font-mono font-bold text-slate-900 outline-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed transition"
          aria-label="Phút (00-59)"
        >
          {!hh && allowEmpty && <option value="">--p</option>}
          {MINUTES_60.map((m) => (
            <option key={m} value={m}>
              {m}p
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal chi tiết ô công + điều chỉnh / chấm công bù / chấm OFF
// ---------------------------------------------------------------------------
