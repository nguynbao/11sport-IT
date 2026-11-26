"use client";

import React from "react";
import { User } from "lucide-react";
import type { Order } from "@/shared/types";
import { formatPhone, formatVND } from "@/shared/utils/format";

interface CustomerProfileSummaryProps {
  customerInfo: any;
  fallbackPhone: string;
  orders: Order[];
}

export function CustomerProfileSummary({
  customerInfo,
  fallbackPhone,
  orders,
}: CustomerProfileSummaryProps) {
  const paidOrders = orders.filter((o) => o.status !== "DRAFT");
  const totalSpent = paidOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);

  return (
    <div className="bg-white text-slate-900 rounded-xl border-2 border-blue-200 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-600 flex items-center justify-center shadow-xs">
          <User className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase text-brand-ink font-bold">
            Hồ sơ Khách hàng 11Sport
          </div>
          <div className="text-lg sm:text-xl font-extrabold break-words text-slate-900">
            {customerInfo.fullName || customerInfo.name || customerInfo.customerName}
          </div>
          <div className="font-mono text-sm text-slate-600">
            SĐT: {formatPhone(customerInfo.phone || customerInfo.customerPhone || fallbackPhone)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:flex md:items-center gap-4 md:gap-6">
        <div className="md:text-right">
          <div className="text-xs text-slate-500">Tổng số đơn đã mua</div>
          <div className="text-xl sm:text-2xl font-mono font-extrabold text-slate-900">
            {paidOrders.length} đơn
          </div>
        </div>
        <div className="md:text-right">
          <div className="text-xs text-slate-500">Tổng chi tiêu tích lũy</div>
          <div className="text-xl sm:text-2xl font-mono font-extrabold text-brand-ink break-all">
            {formatVND(totalSpent)}
          </div>
        </div>
      </div>
    </div>
  );
}
