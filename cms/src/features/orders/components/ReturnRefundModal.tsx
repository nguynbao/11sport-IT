"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Minus, Plus, RotateCcw } from "lucide-react";
import type { Order, ReturnCalculateResult, ReturnReceipt } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { ResponsiveModal } from "@/shared/ui/ResponsiveModal";
import { formatVND } from "@/shared/utils/format";

interface ReturnLineState {
  lineIndex: number;
  productId: string;
  productCode: string;
  productName: string;
  color: string;
  size: string;
  isGift: boolean;
  unitPrice: number;
  maxReturnable: number;
  quantity: number;
  condition: "GOOD" | "DAMAGED";
}

interface Props {
  order: Order | null;
  onClose: () => void;
  onSuccess: (created: ReturnReceipt) => void;
}

export default function ReturnRefundModal({ order, onClose, onSuccess }: Props) {
  const [lines, setLines] = useState<ReturnLineState[]>([]);
  const [refundMethod, setRefundMethod] = useState<"CASH" | "BANKING" | "CARD">("CASH");
  const [note, setNote] = useState("");
  const [calc, setCalc] = useState<ReturnCalculateResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!order) {
      setLines([]);
      setCalc(null);
      setNote("");
      setErrorMsg("");
      return;
    }
    const nextLines: ReturnLineState[] = (order.items || []).map((it, idx) => {
      const qty = Math.max(0, Number(it.quantity) || 0);
      const returned = Math.max(0, Number(it.returnedQuantity) || 0);
      const maxReturnable = Math.max(0, qty - returned);
      return {
        lineIndex: idx,
        productId: String(it.productId),
        productCode: it.productCode || "",
        productName: it.productName || "",
        color: it.color || "",
        size: it.size || "",
        isGift: Boolean(it.isGift) || it.discountType === "GIFT",
        unitPrice: Number(it.unitPrice) || 0,
        maxReturnable,
        quantity: 0,
        condition: "GOOD",
      };
    });
    setLines(nextLines);
    setRefundMethod(
      order.paymentMethod === "BANKING" || order.paymentMethod === "CARD"
        ? order.paymentMethod
        : "CASH"
    );
    setNote("");
    setCalc(null);
    setErrorMsg("");
  }, [order]);

  const activeLines = useMemo(() => lines.filter((l) => l.quantity > 0), [lines]);

  useEffect(() => {
    if (!order || activeLines.length === 0) {
      setCalc(null);
      return;
    }
    let cancelled = false;
    setCalculating(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<ReturnCalculateResult>(API_ENDPOINTS.RETURNS.CALCULATE, {
          method: "POST",
          body: JSON.stringify({
            orderId: order._id,
            type: "RETURN",
            returnItems: activeLines.map((l) => ({
              lineIndex: l.lineIndex,
              productId: l.productId,
              color: l.color,
              size: l.size,
              quantity: l.quantity,
              condition: l.condition,
            })),
          }),
        });
        if (!cancelled && res.data) {
          setCalc(res.data);
          setErrorMsg("");
        }
      } catch (err: any) {
        if (!cancelled) {
          setCalc(null);
          setErrorMsg(err?.message || "Không tính được số tiền hoàn trả.");
        }
      } finally {
        if (!cancelled) setCalculating(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [order, activeLines]);

  if (!order) return null;

  const handleReturnAll = () => {
    setLines((prev) => prev.map((l) => ({ ...l, quantity: l.maxReturnable })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (activeLines.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 sản phẩm muốn trả.");
      return;
    }
    if (!note.trim()) {
      setErrorMsg("Vui lòng nhập lý do trả hàng.");
      return;
    }
    const cashRefundPreview = calc?.cashRefund ?? calc?.returnTotal ?? 0;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Xác nhận trả hàng cho đơn ${order.orderCode || order.code}?\nTổng hoàn: ${formatVND(
          calc?.returnTotal || 0
        )} • Thực hoàn tiền: ${formatVND(cashRefundPreview)}`
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<any>(API_ENDPOINTS.RETURNS.BASE, {
        method: "POST",
        body: JSON.stringify({
          orderId: order._id,
          type: "RETURN",
          refundMethod,
          note: note.trim(),
          returnItems: activeLines.map((l) => ({
            lineIndex: l.lineIndex,
            productId: l.productId,
            color: l.color,
            size: l.size,
            quantity: l.quantity,
            condition: l.condition,
          })),
        }),
      });
      const created: ReturnReceipt = res.data?.returnExchange || res.data;
      onSuccess(created);
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể xử lý phiếu trả hàng.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveModal
      open={Boolean(order)}
      onClose={onClose}
      title={`Trả hàng hoàn tiền: ${order.orderCode || order.code}`}
      subtitle={`${order.customerName || "Khách lẻ"} • Đã thu ${formatVND(order.totalAmount)}`}
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex items-center gap-2">
          <button
            type="submit"
            form="cms-return-refund-form"
            disabled={submitting || calculating || activeLines.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-extrabold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            {submitting ? "Đang xử lý..." : "Xác nhận Trả hàng & Hoàn tiền"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-sm cursor-pointer"
          >
            Hủy
          </button>
        </div>
      }
    >
      <form id="cms-return-refund-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Bước 1: Chọn sản phẩm trả */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              1. Chọn sản phẩm trả lại (Còn bán được → nhập về Kho Tầng 1)
            </h4>
            <button
              type="button"
              onClick={handleReturnAll}
              className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold cursor-pointer shrink-0"
            >
              Trả toàn bộ
            </button>
          </div>

          <div className="space-y-2">
            {lines.map((l, idx) => (
              <div
                key={l.lineIndex}
                className={`rounded-xl border p-3 space-y-2 ${
                  l.quantity > 0 ? "border-teal-400 bg-teal-50/40" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 leading-snug">
                      {l.productName}
                      {l.isGift && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                          🎁 Hàng tặng
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {l.productCode} • Có thể trả: <b>{l.maxReturnable}</b>
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs font-bold text-slate-700 shrink-0">
                    {l.isGift ? "0 ₫" : formatVND(l.unitPrice)}
                  </div>
                </div>

                {l.maxReturnable > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={l.quantity <= 0}
                        onClick={() =>
                          setLines((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, quantity: Math.max(0, item.quantity - 1) } : item
                            )
                          )
                        }
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white disabled:opacity-40 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-9 text-center font-mono text-xs font-extrabold">
                        {l.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={l.quantity >= l.maxReturnable}
                        onClick={() =>
                          setLines((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? { ...item, quantity: Math.min(item.maxReturnable, item.quantity + 1) }
                                : item
                            )
                          )
                        }
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <select
                      value={l.condition}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, condition: e.target.value as "GOOD" | "DAMAGED" }
                              : item
                          )
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                    >
                      <option value="GOOD">Còn bán được (Về Tầng 1)</option>
                      <option value="DAMAGED">Hư hỏng (Không cộng kho)</option>
                    </select>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">Đã trả hết</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bước 2: Hình thức hoàn & Lý do bắt buộc */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Hình thức hoàn tiền
            </label>
            <select
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value as "CASH" | "BANKING" | "CARD")}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
            >
              <option value="CASH">Tiền mặt (CASH)</option>
              <option value="BANKING">Chuyển khoản (BANKING)</option>
              <option value="CARD">Thẻ (CARD)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Lý do trả hàng *
            </label>
            <input
              type="text"
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Khách trả hàng lỗi / không vừa..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
            />
          </div>
        </div>

        {/* Bước 3: Tổng kết số tiền hoàn theo bill */}
        {calc && (
          <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">Tiền hàng trả (đã phân bổ giảm Bill):</span>
              <span className="font-mono font-bold text-slate-900">
                {formatVND(calc.returnSubtotal)}
              </span>
            </div>
            {calc.refundedCardFee > 0 && (
              <div className="flex justify-between text-brand-ink">
                <span>Hoàn lại phí quẹt thẻ:</span>
                <span className="font-mono font-bold">+{formatVND(calc.refundedCardFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-amber-800">
              <span>Tổng giá trị hoàn theo Bill:</span>
              <span className="font-mono">{formatVND(calc.returnTotal)}</span>
            </div>
            {calc.debtReduction > 0 && (
              <div className="flex justify-between text-purple-700 font-semibold">
                <span>Cấn trừ công nợ đơn (còn {formatVND(calc.debtAfter)}):</span>
                <span className="font-mono">-{formatVND(calc.debtReduction)}</span>
              </div>
            )}
            <div className="pt-1.5 border-t border-amber-200 flex justify-between text-sm font-extrabold text-brand-ink">
              <span>Thực hoàn tiền cho khách:</span>
              <span className="font-mono">{formatVND(calc.cashRefund)}</span>
            </div>
          </div>
        )}
      </form>
    </ResponsiveModal>
  );
}
