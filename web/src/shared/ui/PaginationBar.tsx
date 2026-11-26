"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export interface PaginationBarProps {
  totalItems: number;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (sz: number) => void;
  itemLabel?: string;
  pageSizeOptions?: readonly number[];
  showAllOption?: boolean;
}

export function PaginationBar({
  totalItems,
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = "mục",
  pageSizeOptions = [10, 20, 50, 100],
  showAllOption = false,
}: PaginationBarProps) {
  if (totalItems === 0) return null;

  const startIdx = pageSize <= 0 ? 1 : (page - 1) * pageSize + 1;
  const endIdx = pageSize <= 0 ? totalItems : Math.min(page * pageSize, totalItems);

  const pages: number[] = [];
  const maxButtons = 5;
  let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
  const endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }
  for (let i = startPage; i <= endPage; i++) pages.push(i);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 px-3 sm:px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
      <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2">
        <span>
          Hiển thị <strong className="text-slate-900">{startIdx}–{endIdx}</strong> /{" "}
          <strong className="text-slate-900">{totalItems}</strong> {itemLabel}
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1.5 sm:py-1 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
          >
            {pageSizeOptions.map((sz) => (
              <option key={sz} value={sz}>
                {sz} / trang
              </option>
            ))}
            {showAllOption && <option value={0}>Tất cả</option>}
          </select>
        )}
      </div>

      {totalPages > 1 && pageSize > 0 && (
        <div className="flex items-center justify-between sm:justify-end gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            title="Trang đầu"
            className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            title="Trang trước"
            className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="sm:hidden px-2 font-mono font-bold text-slate-800">
            {page} / {totalPages}
          </span>

          <div className="hidden sm:flex items-center gap-1">
            {startPage > 1 && <span className="px-1 text-slate-400">…</span>}
            {pages.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 px-2 rounded border text-xs font-bold transition cursor-pointer ${
                  p === page
                    ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {p}
              </button>
            ))}
            {endPage < totalPages && <span className="px-1 text-slate-400">…</span>}
          </div>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            title="Trang sau"
            className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            title="Trang cuối"
            className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
