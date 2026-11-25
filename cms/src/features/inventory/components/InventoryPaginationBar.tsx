"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export interface InventoryPaginationBarProps {
  totalItems: number;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (sz: number) => void;
  itemLabel?: string;
}

export function InventoryPaginationBar(opts: InventoryPaginationBarProps) {
    const {
      totalItems,
      page,
      totalPages,
      pageSize,
      onPageChange,
      onPageSizeChange,
      itemLabel = "mặt hàng",
    } = opts;
    if (totalItems === 0) return null;
    const startIdx = pageSize <= 0 ? 1 : (page - 1) * pageSize + 1;
    const endIdx =
      pageSize <= 0 ? totalItems : Math.min(page * pageSize, totalItems);

    const pages: number[] = [];
    const maxButtons = 5;
    let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    for (let i = startPage; i <= endPage; i++) pages.push(i);

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Hiển thị{" "}
            <strong className="text-slate-900 font-mono">
              {startIdx}–{endIdx}
            </strong>{" "}
            trên tổng{" "}
            <strong className="text-brand-ink font-mono">{totalItems}</strong>{" "}
            {itemLabel}
          </span>
          <span className="text-slate-300">|</span>
          <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <span>Số dòng/trang:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-900"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>Tất cả ({totalItems})</option>
            </select>
          </label>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(1)}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              title="Trang đầu"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-bold inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Trước
            </button>

            {pages.map((pNum) => (
              <button
                key={pNum}
                type="button"
                onClick={() => onPageChange(pNum)}
                className={`w-8 h-8 rounded-lg font-mono font-extrabold text-xs transition ${pNum === page
                  ? "bg-teal-600 text-white shadow"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
              >
                {pNum}
              </button>
            ))}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-bold inline-flex items-center gap-1"
            >
              Tiếp <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(totalPages)}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              title="Trang cuối"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
}
