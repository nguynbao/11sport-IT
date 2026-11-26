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

  const fields = detail?.fields || [];
  const primaryField = fields[0];
  const restFields = fields.slice(1);

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
      <div className="space-y-3">
        {primaryField && (
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {primaryField.label}
            </div>
            <div className="space-y-1">
              {(primaryField.text || "—").split("\n").map((line, idx) => (
                <div
                  key={idx}
                  className={
                    idx === 0
                      ? "text-xs font-mono font-bold text-slate-500"
                      : idx === 1
                        ? "text-sm font-extrabold text-slate-900 leading-snug"
                        : "text-xs font-semibold text-slate-700 leading-relaxed"
                  }
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}

        {restFields.length > 0 && (
          <dl className="grid grid-cols-2 gap-2.5">
            {restFields.map((f, i) => {
              const lines = (f.text || "—")
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean);
              const isWide =
                f.fullWidth ||
                lines.length > 2 ||
                lines.some((l) => l.length > 34);

              return (
                <div
                  key={`${f.label}-${i}`}
                  className={`${isWide ? "col-span-2" : "col-span-1"} rounded-xl bg-slate-50/90 border border-slate-200/70 p-2.5 space-y-1`}
                >
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                    {f.label}
                  </dt>
                  <dd className="space-y-0.5 break-words">
                    {lines.length === 0 ? (
                      <div className="text-xs font-semibold text-slate-400">—</div>
                    ) : (
                      lines.map((line, idx) => (
                        <div
                          key={idx}
                          className={
                            idx === 0
                              ? "text-[13px] font-extrabold text-slate-900 leading-snug"
                              : "text-[11px] font-medium text-slate-500 leading-snug"
                          }
                        >
                          {line}
                        </div>
                      ))
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>
    </ResponsiveModal>
  );
}
