"use client";

import React from "react";
import type { PosServiceState } from "../hooks/usePosService";
import { Wrench, Plus, Eye } from "lucide-react";

export default function ServiceHeader({ s }: { s: PosServiceState }) {
  const {
    leftView,
    ordersMeta,
    serviceCart,
    setLeftView,
  } = s;

  return (
    <>
        {/* Thanh Header blue-600 đồng bộ với Bán hàng (POS) */}
        <div className="bg-blue-600 text-white px-3.5 pt-2.5 pb-0 flex flex-wrap items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-2 pb-2">
            <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center shadow-xs shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white leading-tight">
                Dịch Vụ (Sửa chữa)
              </h2>
            </div>
          </div>

          <div className="flex items-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setLeftView("COMPOSE")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${leftView === "COMPOSE"
                ? "bg-white text-brand-ink shadow-xs"
                : "bg-blue-700/80 text-white hover:bg-blue-700"
                }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Chọn dịch vụ ({serviceCart.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setLeftView("ORDERS")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${leftView === "ORDERS"
                ? "bg-white text-brand-ink shadow-xs"
                : "bg-blue-700/80 text-white hover:bg-blue-700"
                }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Theo dõi đơn</span>
              {ordersMeta.receivedCount + ordersMeta.inProgressCount + ordersMeta.readyCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${leftView === "ORDERS"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-brand-ink"
                    }`}
                >
                  {ordersMeta.receivedCount + ordersMeta.inProgressCount + ordersMeta.readyCount}
                </span>
              )}
            </button>
          </div>
        </div>
    </>
  );
}
