"use client";

import React from "react";
import type { MyLeaveRequest } from "@/shared/types";
import { Send, FileText, Trash2, ChevronDown, ArrowLeftRight } from "lucide-react";
import { LEAVE_TYPE_META, STATUS_META, fmtDate } from "../leave.constants";
import { useMyLeaveRequests } from "../hooks/useLeaveRequests";

export function MyLeaveRequestsPanel({
  reloadKey,
  onCreate,
  onRequestChangeOff,
  onChanged,
}: {
  reloadKey: number;
  onCreate: () => void;
  onRequestChangeOff?: (leave: MyLeaveRequest) => void;
  onChanged: (msg: string) => void;
}) {
  const { list, loading, filter, setFilter, openId, setOpenId, counts, shown, cancel, FILTERS } =
    useMyLeaveRequests({ reloadKey, onChanged });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:max-h-[calc(100vh-140px)]">
      {/* Tiêu đề + nút tạo đơn */}
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 min-w-0">
          <FileText className="w-4 h-4 text-brand-ink shrink-0" />
          <span className="truncate">Đơn từ của tôi</span>
          {counts.PENDING > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold shrink-0">
              {counts.PENDING} chờ
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onCreate}
          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
        >
          <Send className="w-3 h-3" />
          Tạo đơn
        </button>
      </div>

      {/* Bộ lọc trạng thái gọn */}
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="grid grid-cols-4 bg-slate-100 rounded-lg p-0.5 text-[10px] font-semibold">
          {FILTERS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`px-1 py-1 rounded-md truncate ${filter === k ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
            >
              {label} ({counts[k]})
            </button>
          ))}
        </div>
      </div>

      {/* Danh sách dạng thả xuống */}
      <div className="flex-1 overflow-y-auto">
        {loading && list.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">Đang tải đơn từ...</div>
        ) : shown.length === 0 ? (
          <div className="py-8 px-4 text-center text-xs text-slate-400">
            Chưa có đơn nào.
            <br />
            Bấm <b>Tạo đơn</b> để xin nghỉ, WFH, đi trễ hoặc về sớm.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((l) => {
              const meta = LEAVE_TYPE_META[l.type];
              const st = STATUS_META[l.status];
              const open = openId === l._id;
              return (
                <li key={l._id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : l._id)}
                    className={`w-full px-3 py-2 flex items-center gap-2 text-left transition ${open ? "bg-slate-50" : "hover:bg-slate-50"
                      }`}
                  >
                    <span
                      className={`shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center ${meta.cls}`}
                      title={meta.label}
                    >
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold text-slate-900 truncate">{meta?.label || l.type}</span>
                      <span className="block text-[10px] text-slate-500 font-mono">
                        {l.type === "CHANGE_OFF" && l.fromDate
                          ? `${fmtDate(l.fromDate)} → ${fmtDate(l.date)}`
                          : fmtDate(l.date)}
                      </span>
                    </span>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${st.cls}`}>{st.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>

                  {open && (
                    <div className="px-3 pb-2.5 pt-1 bg-slate-50 space-y-1.5 text-[11px]">
                      {l.type === "CHANGE_OFF" && l.fromDate && (
                        <div className="text-[10px] font-semibold text-brand-ink bg-indigo-50 border border-indigo-200 rounded px-2 py-1">
                          Chuyển ngày nghỉ ({l.sourceOffType === "PAID_LEAVE" ? "Phép có lương" : "OFF không lương"}):{" "}
                          <b>{fmtDate(l.fromDate)}</b> → <b>{fmtDate(l.date)}</b>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400">Lý do: </span>
                        <span className="text-slate-700 break-words">{l.reason}</span>
                      </div>
                      {l.reviewNote && (
                        <div>
                          <span className="text-slate-400">HR: </span>
                          <span className="text-slate-600 italic break-words">{l.reviewNote}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {(l.type === "OFF" || l.type === "PAID_LEAVE") &&
                          (l.status === "APPROVED" || l.status === "PENDING") &&
                          onRequestChangeOff && (
                            <button
                              type="button"
                              onClick={() => onRequestChangeOff(l)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-indigo-200 bg-indigo-50 text-brand-ink hover:bg-indigo-100 text-[10px] font-bold"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              Đổi ngày off
                            </button>
                          )}
                        {l.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => cancel(l._id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-bold"
                          >
                            <Trash2 className="w-3 h-3" />
                            Hủy đơn
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
