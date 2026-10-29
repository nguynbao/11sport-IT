"use client";

import React, { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";

interface ExportExcelButtonProps {
  /** Hàm tạo & tải file; có thể async (VD tải thêm dữ liệu trước khi xuất) */
  onExport: () => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export default function ExportExcelButton({
  onExport,
  disabled,
  label = "Xuất Excel",
  className = "",
}: ExportExcelButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onExport();
    } catch (err: any) {
      alert(err?.message || "Không xuất được file Excel.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      title={disabled ? "Không có dữ liệu để xuất" : "Xuất dữ liệu đang hiển thị ra file Excel (.xlsx)"}
      className={`px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
      {label}
    </button>
  );
}
