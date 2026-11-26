"use client";

import React from "react";
import type { CurrentShiftOrdersMeta, Order } from "@/shared/types";
import { FileText } from "lucide-react";
import { usePosShiftBills } from "../hooks/usePosShiftBills";
import { formatShortVnDate } from "../utils/shiftBills";
import ShiftBillsHeader from "./shiftBills/ShiftBillsHeader";
import ShiftBillsSummary from "./shiftBills/ShiftBillsSummary";
import ShiftBillsFilters from "./shiftBills/ShiftBillsFilters";
import ShiftBillsTable from "./shiftBills/ShiftBillsTable";
import ShiftBillDetailModal from "./shiftBills/ShiftBillDetailModal";

interface PosShiftBillsSectionProps {
  onOpenInvoice: (order: Order) => void;
  onMetaChange?: (meta: CurrentShiftOrdersMeta) => void;
  refreshTrigger?: number;
}

export default function PosShiftBillsSection({
  onOpenInvoice,
  onMetaChange,
  refreshTrigger = 0,
}: PosShiftBillsSectionProps) {
  const s = usePosShiftBills({ onMetaChange, refreshTrigger });
  const { dateFilter, detailOrder } = s;

  return (
    <div className="space-y-4">
      <ShiftBillsHeader
        meta={s.meta}
        dateFilter={dateFilter}
        setDateFilter={s.setDateFilter}
        quickDates={s.quickDates}
        loading={s.loading}
        loadShiftBills={s.loadShiftBills}
      />

      <ShiftBillsSummary summary={s.summary} dateFilter={dateFilter} />

      <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
        <ShiftBillsFilters
          search={s.search}
          setSearch={s.setSearch}
          dateFilter={dateFilter}
          setDateFilter={s.setDateFilter}
          maxDate={s.maxDate}
          shiftFilter={s.shiftFilter}
          setShiftFilter={s.setShiftFilter}
          paymentFilter={s.paymentFilter}
          setPaymentFilter={s.setPaymentFilter}
          statusFilter={s.statusFilter}
          setStatusFilter={s.setStatusFilter}
        />

        {s.errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            {s.errorMsg}
          </div>
        )}

        {/* Danh sách Bill */}
        {s.loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Đang tải danh sách bill trong ngày...
          </div>
        ) : s.orders.length === 0 ? (
          <div className="py-12 text-center space-y-1.5 border border-dashed border-slate-200 rounded-xl">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">
              {dateFilter === "ALL"
                ? "Chưa có bill nào khớp bộ lọc"
                : `Chưa có bill nào trong ngày ${formatShortVnDate(dateFilter)}`}
            </div>
            <p className="text-xs text-slate-400">
              Các đơn hàng phát sinh trong ngày (cả Ca 1 và Ca 2) sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <ShiftBillsTable
            pagedOrders={s.pagedOrders}
            totalBills={s.totalBills}
            page={s.page}
            totalPages={s.totalPages}
            pageSize={s.pageSize}
            setPage={s.setPage}
            setPageSize={s.setPageSize}
            setDetailOrder={s.setDetailOrder}
            onOpenInvoice={onOpenInvoice}
          />
        )}
      </div>

      {detailOrder && (
        <ShiftBillDetailModal
          detailOrder={detailOrder}
          setDetailOrder={s.setDetailOrder}
          onOpenInvoice={onOpenInvoice}
        />
      )}
    </div>
  );
}
