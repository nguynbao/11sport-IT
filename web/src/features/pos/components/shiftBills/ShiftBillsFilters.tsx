import React from "react";
import { Search, X } from "lucide-react";

interface Props {
  search: string;
  setSearch: (v: string) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  maxDate: string;
  shiftFilter: string;
  setShiftFilter: (v: string) => void;
  paymentFilter: string;
  setPaymentFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
}

export default function ShiftBillsFilters({
  search,
  setSearch,
  dateFilter,
  setDateFilter,
  maxDate,
  shiftFilter,
  setShiftFilter,
  paymentFilter,
  setPaymentFilter,
  statusFilter,
  setStatusFilter,
}: Props) {
  return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo Mã Bill (VD: HD-0001), SĐT khách, Tên khách hoặc Tên sản phẩm..."
              className="w-full min-h-[40px] pl-10 pr-8 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-blue-600 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateFilter === "ALL" ? "" : dateFilter}
              max={maxDate}
              onChange={(e) => {
                const v = e.target.value;
                setDateFilter(v ? v : "ALL");
              }}
              title="Chọn ngày kiểm tra bill"
              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-700 bg-white focus:border-blue-600 focus:outline-none"
            />

            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:border-blue-600 focus:outline-none"
            >
              <option value="ALL">🕐 Cả ngày (Mọi ca)</option>
              <option value="SHIFT_1">🌅 Ca 1 (08:30 - 17:30)</option>
              <option value="SHIFT_2">🌆 Ca 2 (12:00 - 21:00)</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:border-blue-600 focus:outline-none"
            >
              <option value="ALL">💳 Mọi hình thức TT</option>
              <option value="CASH">💵 Tiền mặt</option>
              <option value="BANKING">🏦 Chuyển khoản</option>
              <option value="CARD">💳 Quẹt thẻ</option>
              <option value="OTHER">🔀 Tách TT / Khác</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:border-blue-600 focus:outline-none"
            >
              <option value="ALL">📋 Mọi trạng thái</option>
              <option value="PAID">✅ Đã thanh toán</option>
              <option value="DRAFT">📝 Bản nháp</option>
              <option value="PARTIALLY_RETURNED">↩️ Đã trả 1 phần</option>
              <option value="FULLY_RETURNED">🔄 Đã trả toàn bộ</option>
            </select>
          </div>
        </div>
  );
}
