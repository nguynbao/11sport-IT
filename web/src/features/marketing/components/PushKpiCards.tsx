import React from "react";
import { Rocket, Boxes, DollarSign, TrendingDown } from "lucide-react";
import { formatVND } from "@/shared/utils/format";
import type { MarketingPushState } from "../hooks/useMarketingPushProducts";

export default function PushKpiCards({ p }: { p: MarketingPushState }) {
  const { pushFilter, setPushFilter, counts } = p;
  return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setPushFilter("ALL")}
          className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition cursor-pointer ${
            pushFilter === "ALL" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              1. Tổng SP Cần Đẩy Mạnh
            </span>
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Rocket className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-2">
            {counts.all} mặt hàng
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tổng lượng tồn cần đẩy: <strong className="text-slate-800">{counts.totalStock}</strong> sản phẩm
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPushFilter("ZERO_SALES")}
          className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition cursor-pointer ${
            pushFilter === "ZERO_SALES" ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              2. Chưa Bán Được Chiếc Nào
            </span>
            <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 mt-2">
            {counts.zeroSales} mặt hàng
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            SL bán trong kỳ = 0 · Cần chạy nội dung / khuyến mãi
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPushFilter("HIGH_CAPITAL")}
          className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition cursor-pointer ${
            pushFilter === "HIGH_CAPITAL" ? "border-amber-600 ring-2 ring-amber-600/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              3. Đọng Vốn Cao (≥ 2tr)
            </span>
            <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-800 mt-2">
            {counts.highCapital} mặt hàng
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tổng vốn tồn đọng: <strong className="text-amber-800 font-mono">{formatVND(counts.totalCapital)}</strong>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPushFilter("FLOOR2_ONLY")}
          className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition cursor-pointer ${
            pushFilter === "FLOOR2_ONLY" ? "border-purple-600 ring-2 ring-purple-600/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              4. Nằm Ở Kho Tầng 2 (T1 = 0)
            </span>
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Boxes className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-purple-700 mt-2">
            {counts.floor2Only} mặt hàng
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Chưa có hàng trưng bày tại Showroom Tầng 1
          </div>
        </button>
      </div>

  );
}
