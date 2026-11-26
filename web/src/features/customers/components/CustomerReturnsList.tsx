"use client";

import React from "react";
import { RotateCcw } from "lucide-react";
import type { ReturnReceipt } from "@/shared/types";
import { formatDateTime, formatVND } from "@/shared/utils/format";

export function CustomerReturnsList({ returns }: { returns: ReturnReceipt[] }) {
  if (returns.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
      <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-3">
        <RotateCcw className="w-5 h-5 text-amber-600" />
        Lịch sử Phiếu Trả / Đổi Hàng ({returns.length})
      </h3>
      <div className="space-y-2">
        {returns.map((ret) => (
          <div
            key={ret._id}
            className="p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between text-xs gap-2"
          >
            <div>
              <span className="font-mono font-bold text-slate-900">
                {ret.returnCode || ret.code}
              </span>{" "}
              — Đơn gốc:{" "}
              <span className="font-mono font-semibold">{ret.orderCode}</span>
            </div>
            <div className="text-slate-600">
              Loại: <strong>{ret.type === "EXCHANGE" ? "Đổi hàng" : "Trả hàng"}</strong> · Chênh lệch:{" "}
              <span className="font-mono font-bold">{formatVND(ret.netDifference)}</span>
            </div>
            <div className="text-slate-400">{formatDateTime(ret.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
