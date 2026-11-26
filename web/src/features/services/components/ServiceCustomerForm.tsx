"use client";

import React from "react";
import type { PosServiceState } from "../hooks/usePosService";
import { formatPhone } from "@/shared/utils/format";
import { UserCheck } from "lucide-react";
import {
  addDaysToDateStr,
  diffDaysStr,
  getTodayStr,
} from "../types";

export default function ServiceCustomerForm({ s }: { s: PosServiceState }) {
  const {
    customerName,
    customerPhone,
    dueDate,
    dueDaysInput,
    isExistingCustomer,
    lookingUpCustomer,
    receivedDate,
    setCustomerName,
    setCustomerPhone,
    setDueDate,
    setDueDaysInput,
    setReceivedDate,
  } = s;

  return (
    <>
          {/* 1. THÔNG TIN KHÁCH HÀNG & LỊCH HẸN */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                Khách hàng &amp; Lịch hẹn
              </span>
              {lookingUpCustomer && (
                <span className="text-[11px] text-brand-ink font-semibold">
                  Đang tra cứu SĐT...
                </span>
              )}
              {!lookingUpCustomer && isExistingCustomer && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-ink bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  <UserCheck className="w-3 h-3" /> Khách quen
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                placeholder="SĐT khách hàng *"
                className="w-full h-9 px-3 text-xs sm:text-sm font-mono bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-600 rounded-lg outline-none transition"
              />
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Họ tên khách hàng *"
                className="w-full h-9 px-3 text-xs sm:text-sm bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-600 rounded-lg outline-none transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Ngày gửi *
                </label>
                <input
                  type="date"
                  required
                  value={receivedDate}
                  onChange={(e) => {
                    const nextReceived = e.target.value;
                    setReceivedDate(nextReceived);
                    if (dueDaysInput !== "" && nextReceived) {
                      const n = Number(dueDaysInput);
                      if (Number.isFinite(n) && n >= 0) {
                        setDueDate(addDaysToDateStr(nextReceived, n));
                      }
                    } else if (dueDate && nextReceived) {
                      setDueDaysInput(diffDaysStr(nextReceived, dueDate));
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-brand-ink uppercase mb-0.5">
                  Ngày hẹn trả *
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => {
                    const nextDue = e.target.value;
                    setDueDate(nextDue);
                    setDueDaysInput(
                      nextDue ? diffDaysStr(receivedDate || getTodayStr(), nextDue) : ""
                    );
                  }}
                  className={`w-full px-2.5 py-1.5 text-xs font-bold rounded-lg outline-none border focus:border-blue-600 focus:ring-1 focus:ring-blue-500 ${
                    dueDate
                      ? "text-blue-900 bg-blue-50/40 border-blue-500"
                      : "text-slate-700 bg-amber-50/40 border-amber-400"
                  }`}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                <span className="text-[10px] font-bold text-slate-600">Số ngày:</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={dueDaysInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setDueDaysInput(raw);
                    if (raw === "") {
                      setDueDate("");
                      return;
                    }
                    const days = Math.min(365, Math.max(0, Number(raw) || 0));
                    setDueDate(addDaysToDateStr(receivedDate || getTodayStr(), days));
                  }}
                  placeholder="0"
                  className="w-11 text-center font-mono text-xs font-extrabold text-brand-ink bg-white border border-slate-300 rounded px-1 py-0.5 focus:border-blue-600 outline-none"
                />
                <span className="text-[10px] text-slate-500 font-semibold">ngày</span>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {[
                  { label: "Hôm nay", days: 0 },
                  { label: "Mai", days: 1 },
                  { label: "+2 ngày", days: 2 },
                  { label: "+3 ngày", days: 3 },
                  { label: "+7 ngày", days: 7 },
                ].map((preset) => {
                  const target = addDaysToDateStr(
                    receivedDate || getTodayStr(),
                    preset.days
                  );
                  const active = dueDate === target;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setDueDate(target);
                        setDueDaysInput(String(preset.days));
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-400"
                        }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
    </>
  );
}
