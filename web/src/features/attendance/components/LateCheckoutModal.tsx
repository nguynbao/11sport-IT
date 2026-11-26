"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  lateMinutes: number;
  reason: string;
  actionLoading: boolean;
  onReasonChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}

export default function LateCheckoutModal({
  lateMinutes,
  reason,
  actionLoading,
  onReasonChange,
  onCancel,
  onSubmit,
}: Props) {
  return (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-5 space-y-3 text-xs text-slate-800">
            <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              Check-out trễ {lateMinutes} phút sau giờ kết ca
            </div>
            <p className="text-slate-600 leading-relaxed">
              Quy định chỉ cho phép check-out trễ tối đa <b>5 phút</b>. Vì bạn gửi phiếu / check-out sau 5 phút, vui lòng nhập{" "}
              <b>lý do check-out trễ</b> để HR xem xét:
            </p>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="VD: Ở lại tư vấn chốt đơn cho khách đến trễ / kiểm hàng cuối ca..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => onCancel()}
                className="px-3.5 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!reason.trim() || actionLoading}
                onClick={() => onSubmit(reason.trim())}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold cursor-pointer"
              >
                {actionLoading ? "Đang gửi..." : "Gửi lý do & Check-out"}
              </button>
            </div>
          </div>
        </div>
  );
}
