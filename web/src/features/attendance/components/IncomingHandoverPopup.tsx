"use client";

import React from "react";
import type { DailyHandoverCategorySummary, ShiftHandoverRecord } from "@/shared/types";
import { CheckCircle2, AlertTriangle, ClipboardCheck, Coins, X, Plus, Minus } from "lucide-react";
import { localDateStr } from "../utils/localDate";

interface Props {
  pendingHandoverToConfirm: ShiftHandoverRecord;
  activeCheckCategories: string[];
  mustConfirmBeforeCheckout: boolean;
  incomingDiffCount: number;
  incomingCheckLoading: boolean;
  incomingSummaries: DailyHandoverCategorySummary[];
  incomingActualTotals: Record<string, number>;
  setIncomingActualTotals: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  confirmNoteInput: string;
  setConfirmNoteInput: (v: string) => void;
  confirmingHandover: boolean;
  handleDismissIncomingHandover: () => void;
  handleConfirmIncomingHandover: (accept: boolean) => void;
}

export default function IncomingHandoverPopup({
  pendingHandoverToConfirm,
  activeCheckCategories,
  mustConfirmBeforeCheckout,
  incomingDiffCount,
  incomingCheckLoading,
  incomingSummaries,
  incomingActualTotals,
  setIncomingActualTotals,
  confirmNoteInput,
  setConfirmNoteInput,
  confirmingHandover,
  handleDismissIncomingHandover,
  handleConfirmIncomingHandover,
}: Props) {
  return (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-slate-900">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {pendingHandoverToConfirm.date !== localDateStr() ||
                    pendingHandoverToConfirm.shiftCode !== "SHIFT_1"
                      ? `Kiểm Tra & Nhận Bàn Giao Từ Ca Tối (${pendingHandoverToConfirm.date})`
                      : "Kiểm Tra & Nhận Bàn Giao Từ Ca 1"}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Người bàn giao: <b className="text-blue-400">{pendingHandoverToConfirm.fromStaffName}</b> • Nhóm kiểm:{" "}
                    <b className="text-amber-300">{activeCheckCategories.join(" + ")}</b>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissIncomingHandover}
                title="Đóng tạm để kiểm hàng sau"
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-blue-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {mustConfirmBeforeCheckout ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-2.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-extrabold text-rose-900">
                      Bắt buộc xác nhận bàn giao trước khi Kết ca!
                    </div>
                    <p className="mt-0.5 text-rose-700">
                      Bạn chưa xác nhận phiếu bàn giao từ{" "}
                      <b>{pendingHandoverToConfirm.fromStaffName}</b>. Vui lòng kiểm tra tổng số lượng bên dưới và bấm{" "}
                      <b>Xác nhận nhận ca</b>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl">
                  Vui lòng kiểm tra <b>tiền mặt trong quầy</b> và <b>tổng số lượng ({activeCheckCategories.join(" + ")})</b> do{" "}
                  <b>{pendingHandoverToConfirm.fromStaffName}</b> bàn giao rồi bấm <b>Xác nhận nhận ca</b> (khi bạn xác nhận, ca trước sẽ hoàn tất Check-out theo đúng giờ họ đã bấm gửi).
                </div>
              )}

              {/* Thông tin tiền mặt trong quầy */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <Coins className="w-4 h-4 text-amber-600" />
                  <span>Tiền mặt trong quầy bàn giao:</span>
                </div>
                <div className="font-mono text-base font-black text-amber-950">
                  {Number(pendingHandoverToConfirm.cashBalance || 0).toLocaleString("vi-VN")} đ
                </div>
              </div>

              {/* Lý do / Ghi chú từ ca trước */}
              {pendingHandoverToConfirm.notes && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="font-bold text-slate-700">Lý do / Ghi chú từ ca trước: </span>
                  <span className="text-slate-800">{pendingHandoverToConfirm.notes}</span>
                </div>
              )}

              {/* BẢNG TỔNG SỐ LƯỢNG MẶT HÀNG KIỂM TRONG NGÀY */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">
                    Tổng số lượng mặt hàng kiểm ({activeCheckCategories.join(" + ")})
                  </span>
                  {incomingDiffCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                      Đang lệch {incomingDiffCount} nhóm
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-brand-ink font-bold text-[11px]">
                      Khớp tồn Tầng 1
                    </span>
                  )}
                </div>

                {incomingCheckLoading ? (
                  <div className="py-6 text-center text-slate-400">
                    Đang tải tổng số lượng kiểm tra...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incomingSummaries.map((item) => {
                      const key = item.categoryCode || item.categoryName;
                      const expected = item.expectedTotalQty;
                      const actual = incomingActualTotals[key] ?? 0;
                      const isDiff = actual !== expected;
                      const prevReported = Array.isArray(pendingHandoverToConfirm.categoryCounts)
                        ? pendingHandoverToConfirm.categoryCounts.find(
                            (c) =>
                              c.categoryCode === item.categoryCode ||
                              c.categoryName === item.categoryName
                          )?.actualTotalQty
                        : undefined;

                      return (
                        <div
                          key={key}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                            isDiff
                              ? "bg-amber-50/70 border-amber-300"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-extrabold text-xs">
                                {item.categoryName}
                              </span>
                              <span className="font-bold text-slate-700">
                                Tổng tất cả size, màu
                              </span>
                            </div>
                            <div className="mt-1 text-slate-600 flex flex-wrap items-center gap-2">
                              <span>
                                Tồn Tầng 1 đối chiếu:{" "}
                                <b className="font-mono text-slate-900">{expected}</b>{" "}
                                {item.unit || "Cái"}
                              </span>
                              {typeof prevReported === "number" && (
                                <span className="text-brand-ink font-semibold">
                                  • Ca trước đếm:{" "}
                                  <b className="font-mono">{prevReported}</b>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 bg-white border border-slate-300 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() =>
                                setIncomingActualTotals((prev) => ({
                                  ...prev,
                                  [key]: Math.max(0, (prev[key] ?? 0) - 1),
                                }))
                              }
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={actual}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, "");
                                const val = digits ? parseInt(digits, 10) : 0;
                                setIncomingActualTotals((prev) => ({ ...prev, [key]: val }));
                              }}
                              className={`w-14 text-center font-mono font-black text-sm outline-none ${
                                isDiff ? "text-amber-700" : "text-brand-ink"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setIncomingActualTotals((prev) => ({
                                  ...prev,
                                  [key]: (prev[key] ?? 0) + 1,
                                }))
                              }
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ghi chú xác nhận của Ca nhận */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Lý do / Ghi chú của Ca nhận (có thể ghi hoặc không)
                </label>
                <input
                  type="text"
                  value={confirmNoteInput}
                  onChange={(e) => setConfirmNoteInput(e.target.value)}
                  placeholder="VD: Đã đếm đủ tổng số lượng và tiền mặt..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDismissIncomingHandover}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Để sau
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={confirmingHandover}
                  onClick={() => handleConfirmIncomingHandover(false)}
                  className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  Báo lệch thông tin
                </button>
                <button
                  type="button"
                  disabled={confirmingHandover}
                  onClick={() => handleConfirmIncomingHandover(true)}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-md transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {confirmingHandover ? "Đang xác nhận..." : "Xác Nhận Nhận Ca"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
