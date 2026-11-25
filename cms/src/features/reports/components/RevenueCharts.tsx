"use client";

import React, { useState, useEffect } from "react";

export const CHART_COLORS = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#f59e0b", // amber-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#6366f1", // indigo-500
];

export function formatShortVND(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)} tỷ`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}tr`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${abs}`;
}

export function AnimatedNumber({
  value,
  duration = 650,
  formatter = (v: number) => Math.round(v).toLocaleString("vi-VN"),
}: {
  value: number;
  duration?: number;
  formatter?: (v: number) => string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    if (target === 0) {
      setDisplay(0);
      return;
    }
    let rafId = 0;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplay(target);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration]);

  return <>{formatter(display)}</>;
}

/** Biểu đồ Tròn Donut (SVG) hiển thị tỷ trọng trực quan có hiệu ứng tương tác */
export function SvgDonutChart({
  items,
  centerLabel,
  centerValue,
  stacked = false,
}: {
  items: { label: string; value: number; sharePercent: number; color: string; sub?: string }[];
  centerLabel: string;
  centerValue: string;
  stacked?: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, [items]);

  const activeItems = items.filter((i) => i.value > 0);
  const total = activeItems.reduce((s, i) => s + i.value, 0);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  const hoveredItem = hoveredIdx !== null ? items[hoveredIdx] : null;
  const displayLabel = hoveredItem ? hoveredItem.label : centerLabel;
  const displayValue = hoveredItem ? formatShortVND(hoveredItem.value) : centerValue;
  const displaySub = hoveredItem ? `${hoveredItem.sharePercent}%` : null;

  return (
    <div
      className={`flex flex-col ${stacked ? "" : "sm:flex-row"
        } items-center gap-4 bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 overflow-hidden`}
    >
      <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 150 150" className="w-36 h-36 -rotate-90 overflow-visible">
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="transparent"
            stroke="#e2e8f0"
            strokeWidth="18"
          />
          {total > 0 &&
            activeItems.map((item) => {
              const origIdx = items.indexOf(item);
              const pct = item.value / total;
              const targetArc = pct * circumference;
              const strokeDasharray = `${mounted ? targetArc : 0} ${circumference}`;
              const strokeDashoffset = -cumulativePercent * circumference;
              cumulativePercent += pct;
              const isHovered = hoveredIdx === origIdx;
              const isDimmed = hoveredIdx !== null && hoveredIdx !== origIdx;
              return (
                <circle
                  key={`${item.label}-${origIdx}`}
                  cx="75"
                  cy="75"
                  r={radius}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth={isHovered ? "23" : "18"}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  onMouseEnter={() => setHoveredIdx(origIdx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{
                    opacity: isDimmed ? 0.35 : 1,
                    filter: isHovered ? `drop-shadow(0 0 6px ${item.color}66)` : "none",
                  }}
                  className="transition-all duration-500 ease-out cursor-pointer"
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 pointer-events-none">
          <span className="text-[10px] font-bold uppercase text-slate-400 truncate max-w-[92px] transition-all">
            {displayLabel}
          </span>
          <span className="text-xs font-black font-mono text-slate-900 mt-0.5 transition-all">
            {displayValue}
          </span>
          {displaySub && (
            <span className="text-[10px] font-mono font-extrabold text-brand-ink">
              ({displaySub})
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 w-full min-w-0 space-y-1">
        {items.map((item, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={`${item.label}-${idx}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex items-center justify-between text-xs gap-2 px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer min-w-0 ${isHovered
                ? "bg-white shadow-xs ring-1 ring-teal-300 scale-[1.01]"
                : "hover:bg-white/70"
                }`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-200 ${isHovered ? "scale-125" : ""
                    }`}
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-bold text-slate-800 truncate">{item.label}</span>
                {item.sub && (
                  <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                    ({item.sub})
                  </span>
                )}
              </div>
              <div className="font-mono text-right shrink-0 whitespace-nowrap">
                <span className="font-extrabold text-slate-900">{formatShortVND(item.value)}</span>
                <span className="ml-1 text-[11px] font-bold text-slate-500">
                  ({item.sharePercent}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

