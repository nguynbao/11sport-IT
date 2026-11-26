"use client";

import React from "react";
import type { PosServiceState } from "../hooks/usePosService";
import { formatVND, formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { Wrench, Plus, Minus, Trash2 } from "lucide-react";
import {
  computeServiceLinePricing,
} from "../types";

export default function ServiceCart({ s }: { s: PosServiceState }) {
  const {
    handleRemoveLine,
    handleUpdateLine,
    serviceCart,
  } = s;

  return (
    <>
            {/* 2. DANH SÁCH DỊCH VỤ ĐÃ CHỌN & SỬA GIÁ */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-900 mb-2">
                2. Chi tiết dịch vụ &amp; Giá thực tế ({serviceCart.length})
              </label>

              {serviceCart.length === 0 ? (
                <div className="py-10 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-2">
                  <div className="w-11 h-11 rounded-full bg-blue-50 text-brand-ink flex items-center justify-center mx-auto">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    Chưa chọn dịch vụ nào trong phiếu
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Hãy bấm vào Loại dịch vụ ở mục 1 phía trên để thêm vào phiếu.
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {serviceCart.map((line, idx) => {
                    const linePricing = computeServiceLinePricing(line);
                    return (
                      <div
                        key={line.key}
                        className="p-3 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-extrabold text-slate-900">
                              #{idx + 1}. {line.serviceName}
                            </span>
                            <span className="ml-2 text-[11px] text-slate-500">
                              (Giá chuẩn: {formatVND(line.defaultPrice)}/{line.unit})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.key)}
                            className="text-red-500 hover:text-red-700 p-1 rounded"
                            title="Xóa dòng dịch vụ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-7">
                            <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                              Đơn giá thực tế (VNĐ) *
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatNumberDots(line.unitPrice)}
                              onChange={(e) =>
                                handleUpdateLine(line.key, {
                                  unitPrice: parseNumberDots(e.target.value),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-sm font-mono font-extrabold text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>

                          <div className="col-span-5">
                            <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                              Số lượng ({line.unit})
                            </label>
                            <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateLine(line.key, {
                                    quantity: Math.max(1, line.quantity - 1),
                                  })
                                }
                                className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="flex-1 text-center font-mono text-xs font-extrabold">
                                {line.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateLine(line.key, {
                                    quantity: line.quantity + 1,
                                  })
                                }
                                className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* GIẢM GIÁ DÒNG DỊCH VỤ */}
                        <div className="pt-1 border-t border-slate-200/70 space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex flex-wrap items-center gap-1">
                              {(
                                [
                                  { id: "NONE", label: "Không giảm" },
                                  { id: "PERCENT", label: "Giảm %" },
                                  { id: "AMOUNT", label: "Giảm tiền" },
                                  { id: "PRICE", label: "Giá thu" },
                                ] as const
                              ).map((dm) => (
                                <button
                                  key={dm.id}
                                  type="button"
                                  onClick={() =>
                                    handleUpdateLine(line.key, {
                                      discountMode: dm.id,
                                      discountInput: "",
                                    })
                                  }
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${line.discountMode === dm.id
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"
                                    }`}
                                >
                                  {dm.label}
                                </button>
                              ))}
                            </div>

                            <div className="text-right font-mono text-xs">
                              {linePricing.discountAmount > 0 && (
                                <span className="text-[11px] text-slate-400 line-through mr-1.5">
                                  {formatVND(linePricing.grossLine)}
                                </span>
                              )}
                              <span className="font-extrabold text-brand-ink">
                                {formatVND(linePricing.lineTotal)}
                              </span>
                            </div>
                          </div>

                          {line.discountMode !== "NONE" && (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  line.discountMode === "PERCENT"
                                    ? line.discountInput
                                    : line.discountInput
                                      ? formatNumberDots(parseNumberDots(line.discountInput))
                                      : ""
                                }
                                onChange={(e) => {
                                  if (line.discountMode === "PERCENT") {
                                    const raw = e.target.value.replace(/[^0-9.]/g, "");
                                    handleUpdateLine(line.key, { discountInput: raw });
                                  } else {
                                    const num = parseNumberDots(e.target.value);
                                    handleUpdateLine(line.key, {
                                      discountInput: num > 0 ? String(num) : "",
                                    });
                                  }
                                }}
                                placeholder={
                                  line.discountMode === "PERCENT"
                                    ? "Nhập % giảm (VD: 10)..."
                                    : line.discountMode === "AMOUNT"
                                      ? "Số tiền giảm (VNĐ)..."
                                      : "Nhập thành tiền thu sau giảm (VNĐ)..."
                                }
                                className="flex-1 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                              />
                              {linePricing.discountAmount > 0 && (
                                <span className="text-[11px] font-mono font-bold text-amber-700 shrink-0">
                                  -{formatVND(linePricing.discountAmount)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <input
                            type="text"
                            value={line.itemNote}
                            onChange={(e) =>
                              handleUpdateLine(line.key, { itemNote: e.target.value })
                            }
                            placeholder="Ghi chú đồ khách gửi (VD: Vợt Astrox 88D, căng 11kg, cước BG65...)"
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
    </>
  );
}
