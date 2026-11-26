import React from "react";
import { X, ScanLine, Zap } from "lucide-react";

interface Props {
  percent: number;
  scannedUnits: number;
  expectedUnits: number;
  fullRows: number;
  totalRows: number;
  onClose: () => void;
}

export default function TagCheckHeader({
  percent,
  scannedUnits,
  expectedUnits,
  fullRows,
  totalRows,
  onClose,
}: Props) {
  return (
    <div className="bg-blue-600 text-white px-3 sm:px-5 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ScanLine className="w-5 h-5 text-amber-400 shrink-0" />
          <h3 className="font-bold text-base sm:text-lg truncate">Bước 4: Chụp tag kiểm tra thực tế</h3>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold">
            <Zap className="w-3 h-3" /> Fast OCR ≤ 5s
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 rounded-full bg-slate-700 overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-xs sm:text-sm font-extrabold font-mono whitespace-nowrap">
          {scannedUnits}/{expectedUnits} chiếc · {fullRows}/{totalRows} dòng đủ
        </span>
      </div>
    </div>
  );
}
