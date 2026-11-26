"use client";

import { ShoppingCart, Wrench } from "lucide-react";
import { PosServiceSection } from "@/features/services";
import type { ServiceOrdersMeta } from "@/shared/types";

interface PosServicesModeBarProps {
  onSelectProductsMode: () => void;
  serviceMeta: ServiceOrdersMeta | null;
  onMetaChange: (meta: ServiceOrdersMeta | null) => void;
}

export function PosServicesModeBar({
  onSelectProductsMode,
  serviceMeta,
  onMetaChange,
}: PosServicesModeBarProps) {
  const pendingCount = serviceMeta
    ? serviceMeta.receivedCount + serviceMeta.inProgressCount + serviceMeta.readyCount
    : 0;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSelectProductsMode}
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-extrabold flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-brand-ink transition"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>← Quay lại Bán sản phẩm (POS)</span>
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-extrabold flex items-center gap-2 bg-blue-600 text-white shadow-xs transition"
          >
            <Wrench className="w-4 h-4" />
            <span>Làm dịch vụ (Nhận đồ & Hẹn trả)</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white/20 text-white">
                {pendingCount} đơn chờ
              </span>
            )}
            {serviceMeta && serviceMeta.overdueCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-600 text-white">
                ⚠️ {serviceMeta.overdueCount} quá hạn
              </span>
            )}
          </button>
        </div>
        <div className="text-xs text-slate-500 hidden md:block pr-2">
          Nhận đồ khách gửi làm dịch vụ (đan vợt, hàn vợt, vệ sinh...) • Hẹn ngày trả & theo dõi tiến độ
        </div>
      </div>
      <PosServiceSection onMetaChange={onMetaChange} />
    </div>
  );
}
