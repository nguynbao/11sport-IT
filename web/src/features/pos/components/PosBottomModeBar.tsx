"use client";

import { FileText, Zap, Clock } from "lucide-react";

interface PosBottomModeBarProps {
  posSubView: "FAST" | "CATALOG" | "DRAFTS";
  savedDraftsCount: number;
  floor1ProductsCount: number;
  onSelectFast: () => void;
  onSelectCatalog: () => void;
  onSelectDrafts: () => void;
}

export function PosBottomModeBar({
  posSubView,
  savedDraftsCount,
  floor1ProductsCount,
  onSelectFast,
  onSelectCatalog,
  onSelectDrafts,
}: PosBottomModeBarProps) {
  return (
    <div className="bg-white border-t border-slate-200 pl-14 sm:pl-16 pr-3 flex flex-wrap items-center justify-between gap-2 text-xs select-none shrink-0">
      <div className="flex items-center gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={onSelectFast}
          className={`px-4 py-2.5 font-extrabold flex items-center gap-1.5 border-t-2 transition ${
            posSubView === "FAST"
              ? "border-blue-600 text-brand-ink bg-blue-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Bán nhanh</span>
        </button>

        <button
          type="button"
          onClick={onSelectCatalog}
          className={`px-4 py-2.5 font-extrabold flex items-center gap-1.5 border-t-2 transition ${
            posSubView === "CATALOG"
              ? "border-blue-600 text-brand-ink bg-blue-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Bán thường</span>
        </button>

        <button
          type="button"
          onClick={onSelectDrafts}
          className={`px-4 py-2.5 font-extrabold flex items-center gap-1.5 border-t-2 transition ${
            posSubView === "DRAFTS"
              ? "border-blue-600 text-brand-ink bg-blue-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Hóa đơn nháp ({savedDraftsCount})</span>
        </button>
      </div>

      <div className="hidden sm:flex items-center gap-2 py-1.5 text-[11px] text-slate-500">
        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-brand-ink font-bold border border-blue-200">
          11 Sport POS • Kho Tầng 1 ({floor1ProductsCount} SP)
        </span>
      </div>
    </div>
  );
}
