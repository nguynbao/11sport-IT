"use client";

import { CheckCircle2, AlertCircle, X } from "lucide-react";

export interface ScanBannerState {
  type: "success" | "warning" | "error";
  message: string;
  time: string;
}

interface PosScanBannerProps {
  banner: ScanBannerState;
  onDismiss: () => void;
}

export function PosScanBanner({ banner, onDismiss }: PosScanBannerProps) {
  return (
    <div
      className={`mx-3 mt-2 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 border ${
        banner.type === "success"
          ? "bg-blue-50 border-blue-300 text-blue-900"
          : banner.type === "warning"
            ? "bg-amber-50 border-amber-300 text-amber-900"
            : "bg-red-50 border-red-300 text-red-900"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {banner.type === "success" ? (
          <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
        )}
        <span className="truncate">{banner.message}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-mono opacity-75">{banner.time}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-700"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
