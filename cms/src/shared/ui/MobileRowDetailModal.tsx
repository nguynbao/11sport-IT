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
      subtitle="Thông tin chi tiết"
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
      <dl className="divide-y divide-slate-100">
        {(detail?.fields || []).map((f, i) => {
          const isBlock =
            f.fullWidth || f.text.includes("\n") || f.text.length > 30;

          if (isBlock) {
            return (
              <div
                key={`${f.label}-${i}`}
                className="py-3 first:pt-0 last:pb-0 space-y-1.5"
              >
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {f.label}
                </dt>
                <dd className="text-[13px] font-semibold text-slate-900 whitespace-pre-line break-words leading-relaxed">
                  {f.text || "—"}
                </dd>
              </div>
            );
          }

          return (
            <div
              key={`${f.label}-${i}`}
              className="py-2.5 first:pt-0 last:pb-0 flex items-baseline justify-between gap-4"
            >
              <dt className="text-xs font-medium text-slate-500 shrink-0">
                {f.label}
              </dt>
              <dd className="text-[13px] font-bold text-slate-900 text-right break-words">
                {f.text || "—"}
              </dd>
            </div>
          );
        })}
      </dl>
    </ResponsiveModal>
  );
}
