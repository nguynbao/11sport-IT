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

export function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  tone: "slate" | "blue" | "amber" | "rose" | "red";
}) {
  const toneMap = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    blue: "bg-teal-50 border-teal-200 text-brand-ink",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    red: "bg-red-50 border-red-200 text-red-700",
  } as const;
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneMap[tone]}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-90">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl font-extrabold text-slate-900 mt-0.5">{value}</div>
      {sub && <div className="text-[10px] opacity-75 truncate">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ma trận nhân viên × ngày
// ---------------------------------------------------------------------------
