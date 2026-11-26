"use client";

import { Calculator, ChevronLeft, ChevronRight } from "lucide-react";
import { useWiseCalculator } from "../hooks/useWiseCalculator";
import WiseCalculatorPanel from "./wiseCalculator/WiseCalculatorPanel";

export default function WiseCalculatorStash() {
  const calc = useWiseCalculator();
  const { isOpen, setIsOpen, isStashedEdge, setIsStashedEdge } = calc;

  return (
    <div className="fixed bottom-20 md:bottom-5 left-0 z-50 flex flex-col items-start print:hidden select-none">
      {/* Cửa sổ nhỏ Máy tính Đổi tiền đơn giản */}
      {isOpen && <WiseCalculatorPanel calc={calc} />}

      {/* Nút Logo Tròn (Hình Máy Tính) dạng Stash mặc định ở góc trái dưới */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          title="Máy tính đổi tiền nhanh"
          aria-label="Mở máy tính đổi tiền nhanh"
          className={`group relative flex items-center gap-2 bg-gradient-to-br from-blue-500 via-blue-600 to-teal-700 hover:from-blue-400 hover:to-teal-600 text-white shadow-2xl border-2 border-white/90 transition-all duration-300 ${
            isOpen
              ? "ml-3 sm:ml-4 w-13 h-13 p-3.5 rounded-full justify-center ring-4 ring-blue-500/30"
              : isStashedEdge
              ? "w-13 h-13 py-3.5 pl-2.5 pr-3.5 rounded-r-full rounded-l-none justify-end -translate-x-1 hover:translate-x-0"
              : "ml-3 w-13 h-13 p-3.5 rounded-full justify-center hover:scale-105"
          }`}
        >
          <Calculator className="w-6 h-6 text-white stroke-[2.2] shrink-0" />
        </button>

        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsStashedEdge((v) => !v)}
            title={isStashedEdge ? "Kéo nút ra" : "Né gọn vào mép (Stash)"}
            className="h-8 w-5 rounded-r-lg bg-slate-900/90 hover:bg-blue-700 text-blue-400 border border-l-0 border-blue-500/40 flex items-center justify-center shadow-md transition"
          >
            {isStashedEdge ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
