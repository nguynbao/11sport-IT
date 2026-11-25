"use client";

import { ServiceOrderStatus,ServicePaymentMethod } from "@/shared/types";
import { formatNumberDots,formatPhone,formatVND,parseNumberDots } from "@/shared/utils/format";
import {
X
} from "lucide-react";
import { ServiceManagementViewModel } from "../hooks/useServiceManagement";
const STATUS_INFO: Record<
  ServiceOrderStatus,
  { label: string; badgeCls: string }
> = {
  RECEIVED: {
    label: "Đã tiếp nhận",
    badgeCls: "bg-teal-50 text-brand-ink border-teal-200",
  },
  IN_PROGRESS: {
    label: "Đang xử lý",
    badgeCls: "bg-amber-50 text-amber-800 border-amber-300",
  },
  READY: {
    label: "Đã xong (Chờ lấy)",
    badgeCls: "bg-teal-50 text-brand-ink border-teal-300",
  },
  RETURNED: {
    label: "Đã trả khách",
    badgeCls: "bg-slate-100 text-slate-700 border-slate-300",
  },
  CANCELLED: {
    label: "Đã hủy",
    badgeCls: "bg-red-50 text-red-600 border-red-200",
  },
};

function formatDateDisplay(raw?: string | null): string {
  if (!raw) return "—";
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toInputDate(raw?: string | null): string {
  if (!raw) return "";
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ServicePaymentModal({ vm }: { vm: ServiceManagementViewModel }) {
  const {
    collectOrder,
    setCollectOrder,
    collectAmount,
    setCollectAmount,
    collectMethod,
    setCollectMethod,
    setCollectHasCardFee,
    collectCardFeePercent,
    setCollectCardFeePercent,
    collectNote,
    setCollectNote,
    markReturnedOnCollect,
    handleSubmitCollect,
  } = vm;

  return (
    <>
      {/* MODAL THU TIỀN / TRẢ ĐỒ */}
      {collectOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                {markReturnedOnCollect
                  ? `Trả Đồ & Thu Tiền (${collectOrder.orderCode})`
                  : `Thu Tiền Đơn Dịch Vụ (${collectOrder.orderCode})`}
              </h3>
              <button
                type="button"
                onClick={() => setCollectOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCollect} className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>
                  Khách hàng: <strong>{collectOrder.customerName}</strong> (
                  {formatPhone(collectOrder.customerPhone)})
                </div>
                <div>
                  Tổng tiền:{" "}
                  <strong className="font-mono">
                    {formatVND(collectOrder.totalAmount)}
                  </strong>{" "}
                  • Đã thu:{" "}
                  <strong className="font-mono text-brand-ink">
                    {formatVND(collectOrder.paidAmount)}
                  </strong>
                </div>
                <div className="text-sm font-extrabold text-rose-600 pt-1">
                  Còn phải thu: {formatVND(collectOrder.remainingAmount)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số tiền thu lần này (VNĐ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(collectAmount)}
                  onChange={(e) =>
                    setCollectAmount(
                      Math.min(
                        collectOrder.remainingAmount,
                        parseNumberDots(e.target.value)
                      )
                    )
                  }
                  className="w-full px-3 py-2 text-sm font-mono font-extrabold bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phương thức thanh toán
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "CASH", label: "Tiền mặt" },
                    { id: "BANKING", label: "Chuyển khoản" },
                    { id: "CARD", label: "Quẹt thẻ" },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => {
                        const m = pm.id as ServicePaymentMethod;
                        setCollectMethod(m);
                        setCollectHasCardFee(m === "CARD");
                      }}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border ${
                        collectMethod === pm.id
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-white text-slate-700 border-slate-300"
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {collectMethod === "CARD" && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
                  <div className="text-[11px] font-bold text-amber-900">
                    Phí quẹt thẻ (tính trên {formatVND(collectAmount)}):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${
                        Number(collectCardFeePercent) === 4
                          ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                          : "bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="cmsServiceCollectCardFeeType"
                        checked={Number(collectCardFeePercent) === 4}
                        onChange={() => {
                          setCollectHasCardFee(true);
                          setCollectCardFeePercent("4");
                        }}
                        className="accent-amber-600"
                      />
                      <span>
                        Khách nước ngoài 4% (+
                        {formatVND(Math.round(collectAmount * 0.04))})
                      </span>
                    </label>
                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${
                        Number(collectCardFeePercent) !== 4
                          ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                          : "bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="cmsServiceCollectCardFeeType"
                        checked={Number(collectCardFeePercent) !== 4}
                        onChange={() => {
                          setCollectHasCardFee(true);
                          setCollectCardFeePercent("1.8");
                        }}
                        className="accent-amber-600"
                      />
                      <span>
                        Khách Việt 1.8% (+
                        {formatVND(Math.round(collectAmount * 0.018))})
                      </span>
                    </label>
                  </div>
                  <div className="flex justify-between text-amber-800 pt-0.5">
                    <span>
                      Phí thẻ (+{collectCardFeePercent}%): +
                      {formatVND(
                        Math.round(
                          (collectAmount *
                            Math.max(0, Number(collectCardFeePercent) || 0)) /
                            100
                        )
                      )}
                    </span>
                    <strong className="font-mono">
                      Tổng quẹt:{" "}
                      {formatVND(
                        collectAmount +
                          Math.round(
                            (collectAmount *
                              Math.max(0, Number(collectCardFeePercent) || 0)) /
                              100
                          )
                      )}
                    </strong>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú thu tiền
                </label>
                <input
                  type="text"
                  value={collectNote}
                  onChange={(e) => setCollectNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectOrder(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}
