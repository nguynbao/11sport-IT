"use client";

import { ArrowDown, RefreshCw } from "lucide-react";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  isReadyToRefresh: boolean;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  isReadyToRefresh,
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 6 && !isRefreshing) return null;

  return (
    <div
      className="fixed left-0 right-0 z-40 flex justify-center pointer-events-none transition-transform duration-150 print:hidden"
      style={{ top: `${Math.min(72, Math.max(10, pullDistance - 24))}px` }}
    >
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg text-xs font-bold text-slate-800">
        {isRefreshing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-brand-ink animate-spin" />
            <span>Đang làm mới trang...</span>
          </>
        ) : isReadyToRefresh ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-brand-ink" />
            <span>Thả tay để làm mới</span>
          </>
        ) : (
          <>
            <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Kéo xuống để làm mới</span>
          </>
        )}
      </div>
    </div>
  );
}
