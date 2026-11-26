import React from "react";
import { CheckCircle2, Minus, Plus } from "lucide-react";
import type { ImportItem } from "@/shared/types";
import { expectedOf, isFullRow, scannedOf } from "../../utils/tagCheckHelpers";

interface Props {
  items: ImportItem[];
  allDone: boolean;
  totalRows: number;
  scannedUnits: number;
  expectedUnits: number;
  highlightIndex: number | null;
  busy: boolean;
  onRowAction: (body: Record<string, any>) => void;
}

export default function TagCheckItemList({
  items,
  allDone,
  totalRows,
  scannedUnits,
  expectedUnits,
  highlightIndex,
  busy,
  onRowAction,
}: Props) {
  return (
    <div className="lg:col-span-2 space-y-2">
      {allDone && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-300 text-blue-900 text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> Đã kiểm đủ tất cả {totalRows} dòng! Đóng cửa sổ và bấm
          &quot;Hoàn thành Nhập Kho&quot;.
        </div>
      )}
      <div className="text-[11px] font-bold uppercase text-slate-500">
        Danh sách kiểm hàng — còn thiếu {Math.max(0, expectedUnits - scannedUnits)} chiếc
      </div>
      <div className="space-y-1.5 max-h-[40vh] lg:max-h-[62vh] overflow-y-auto pr-1">
        {items.map((it, idx) => {
          const scanned = scannedOf(it);
          const expected = expectedOf(it);
          const full = isFullRow(it);
          const rowPct = expected ? Math.min(100, Math.round((scanned / expected) * 100)) : full ? 100 : 0;
          return (
            <div
              key={idx}
              className={`px-2.5 py-2 rounded-lg border text-xs transition ${
                highlightIndex === idx
                  ? "border-blue-500 ring-2 ring-blue-300 bg-blue-50"
                  : full
                  ? "border-blue-200 bg-blue-50/50"
                  : scanned > 0
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                    full ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
                  }`}
                >
                  {full && <CheckCircle2 className="w-3 h-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`font-semibold break-words whitespace-normal leading-snug ${full ? "text-blue-900" : "text-slate-900"}`}>
                    #{idx + 1} {it.productName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono break-all whitespace-normal">
                    {it.productCode}
                    {it.barcode ? ` · EAN ${it.barcode}` : ""}
                  </div>
                </div>
                <span
                  className={`font-mono font-extrabold whitespace-nowrap ${
                    full ? "text-brand-ink" : scanned > 0 ? "text-amber-700" : "text-slate-500"
                  }`}
                >
                  {scanned}/{expected}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full ${full ? "bg-blue-500" : "bg-amber-400"}`}
                    style={{ width: `${rowPct}%` }}
                  />
                </div>
                {/* Điều chỉnh tay khi tag hỏng / không đọc được */}
                <button
                  type="button"
                  disabled={busy || scanned === 0}
                  onClick={() => onRowAction({ rowIndex: idx, delta: -1 })}
                  className="w-8 h-8 rounded-md border border-slate-300 bg-white flex items-center justify-center disabled:opacity-40"
                  title="Bớt 1 chiếc"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy || full}
                  onClick={() => onRowAction({ rowIndex: idx })}
                  className="w-8 h-8 rounded-md border border-slate-300 bg-white flex items-center justify-center disabled:opacity-40"
                  title="Thêm 1 chiếc (khi tag không đọc được)"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
