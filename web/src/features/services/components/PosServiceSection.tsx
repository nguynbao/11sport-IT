"use client";

import React from "react";
import type { ServiceOrdersMeta } from "@/shared/types";
import { Wrench } from "lucide-react";
import { usePosService } from "../hooks/usePosService";
import ServiceHeader from "./ServiceHeader";
import ServiceCatalogPanel from "./ServiceCatalogPanel";
import ServiceCart from "./ServiceCart";
import ServiceOrdersList from "./ServiceOrdersList";
import ServiceMessages from "./ServiceMessages";
import ServiceCustomerForm from "./ServiceCustomerForm";
import ServiceTotals from "./ServiceTotals";
import ServicePaymentPanel from "./ServicePaymentPanel";
import CollectModal from "./CollectModal";
import PrintServiceReceipt from "./PrintServiceReceipt";

export default function PosServiceSection({
  onMetaChange,
}: {
  onMetaChange?: (meta: ServiceOrdersMeta) => void;
}) {
  const s = usePosService({ onMetaChange });
  const {
    leftView,
    errorMsg,
    submitting,
    serviceCart,
    handleCreateServiceOrder,
    collectModalOrder,
    printOrder,
  } = s;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-start">
      {/* ==================== CỘT TRÁI (8 CỘT): CHỌN DỊCH VỤ & CHI TIẾT PHIẾU / THEO DÕI ĐƠN ==================== */}
      <div className="lg:col-span-8 bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
        <ServiceHeader s={s} />

        {leftView === "COMPOSE" ? (
          <div className="p-4 space-y-4">
            <ServiceCatalogPanel s={s} />
            <ServiceCart s={s} />
          </div>
        ) : (
          <ServiceOrdersList s={s} />
        )}
      </div>

      {/* ==================== CỘT PHẢI (4 CỘT): BILL PHIẾU DỊCH VỤ & THANH TOÁN (ĐỒNG BỘ BÁN HÀNG) ==================== */}
      <form
        onSubmit={handleCreateServiceOrder}
        className="lg:col-span-4 bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col justify-between gap-3"
      >
        <div className="space-y-3">
          {/* Header Bill Phải */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <span className="text-xs font-extrabold uppercase tracking-wide text-slate-900">
                Bill Phiếu Dịch Vụ
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-brand-ink border border-blue-200 text-[11px] font-mono font-extrabold">
              {serviceCart.length} dịch vụ
            </span>
          </div>

          <ServiceMessages s={s} />

          <ServiceCustomerForm s={s} />
          <ServiceTotals s={s} />
          <ServicePaymentPanel s={s} />
        </div>

        {/* Nút CTA lớn đáy Bill phải (Đồng bộ nút THANH TOÁN ở Bán hàng) */}
        <button
          type="submit"
          disabled={submitting || serviceCart.length === 0}
          className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold text-base tracking-wide uppercase flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
        >
          <Wrench className="w-4 h-4" />
          <span>{submitting ? "Đang tạo phiếu..." : "Tạo Phiếu Dịch Vụ"}</span>
        </button>
      </form>

      {collectModalOrder && <CollectModal s={s} />}
      {printOrder && <PrintServiceReceipt s={s} />}
    </div>
  );
}
