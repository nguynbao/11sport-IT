"use client";

import { Calculator, ChevronLeft, ChevronRight } from "lucide-react";
import { useWiseCalculator } from "../hooks/useWiseCalculator";
import WiseCalculatorPanel from "./wiseCalculator/WiseCalculatorPanel";

export default function WiseCalculatorStash() {
  const calc = useWiseCalculator();
  const { isOpen, setIsOpen, isStashedEdge, setIsStashedEdge } = calc;

  return (
    <div
      className={`fixed bottom-20 md:bottom-5 left-0 flex flex-col items-start print:hidden select-none ${
        isOpen ? "z-50" : "z-30"
      }`}
    >
      {/* Cửa sổ nhỏ Máy tính Đổi tiền đơn giản */}
      {isOpen && <WiseCalculatorPanel calc={calc} />}

      {/* Trạng thái thu gọn: chỉ lộ 1 tab nhỏ chìa ra ở mép trái */}
      {!isOpen && isStashedEdge ? (
        <button
          type="button"
          onClick={() => setIsStashedEdge(false)}
          title="Mở nút Máy tính đổi tiền nhanh"
          aria-label="Kéo nút máy tính đổi tiền ra"
          className="group flex items-center justify-center w-6 h-11 rounded-r-xl bg-blue-600/95 hover:bg-blue-700 hover:w-8 text-white border border-l-0 border-white/80 shadow-md transition-all duration-200 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>
      ) : (
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            title="Máy tính đổi tiền nhanh"
            aria-label="Mở máy tính đổi tiền nhanh"
            className={`group relative flex items-center gap-2 bg-gradient-to-br from-blue-500 via-blue-600 to-teal-700 hover:from-blue-400 hover:to-teal-600 text-white shadow-2xl border-2 border-white/90 transition-all duration-300 cursor-pointer ${
              isOpen
                ? "ml-3 sm:ml-4 w-12 h-12 p-3 rounded-full justify-center ring-4 ring-blue-500/30"
                : "ml-2.5 w-11 h-11 p-2.5 rounded-full justify-center hover:scale-105"
            }`}
          >
            <Calculator className="w-5 h-5 text-white stroke-[2.2] shrink-0" />
          </button>

          {!isOpen && (
            <button
              type="button"
              onClick={() => setIsStashedEdge(true)}
              title="Thu ẩn gọn vào mép trái"
              aria-label="Thu ẩn nút máy tính vào mép trái"
              className="ml-1 h-7 w-5 rounded-lg bg-slate-900/85 hover:bg-blue-700 text-white border border-white/20 flex items-center justify-center shadow-md transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
