"use client";

import React, { useEffect, useState } from "react";
import { ResponsiveModal } from "./ResponsiveModal";

export interface RowDetailField {
  label: string;
  text: string;
  fullWidth?: boolean;
}

export interface RowDetailPayload {
  title: string;
  fields: RowDetailField[];
}

export const OPEN_ROW_DETAIL_EVENT = "cms-open-row-detail";

export function MobileRowDetailModal() {
  const [detail, setDetail] = useState<RowDetailPayload | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const custom = e as CustomEvent<RowDetailPayload>;
      if (custom.detail) {
        setDetail(custom.detail);
      }
    };
    window.addEventListener(OPEN_ROW_DETAIL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ROW_DETAIL_EVENT, onOpen);
  }, []);

  return (
    <ResponsiveModal
      open={Boolean(detail)}
      onClose={() => setDetail(null)}
      title={detail?.title || "Chi tiết dòng"}
      subtitle="Xem đầy đủ nội dung"
      maxWidthClass="max-w-lg"
      footer={
        <button
          type="button"
          onClick={() => setDetail(null)}
          className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm cursor-pointer"
        >
          Đóng
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2.5">
        {(detail?.fields || []).map((f, i) => {
          const isWide =
            f.fullWidth || f.text.includes("\n") || f.text.length > 34;
          return (
            <div
              key={`${f.label}-${i}`}
              className={`rounded-xl bg-slate-50/90 border border-slate-200/80 px-3 py-2.5 space-y-1 ${
                isWide ? "col-span-2" : "col-span-1"
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {f.label}
              </div>
              <div className="text-[13px] font-semibold text-slate-900 whitespace-pre-line break-words leading-snug">
                {f.text || "—"}
              </div>
            </div>
          );
        })}
      </div>
    </ResponsiveModal>
  );
}
