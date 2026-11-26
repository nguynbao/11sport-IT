"use client";

import React from "react";
import { Phone, Search } from "lucide-react";
import { formatPhone } from "@/shared/utils/format";

interface CustomerSearchCardProps {
  phone: string;
  loading: boolean;
  filteredCustomers: any[];
  onPhoneChange: (val: string) => void;
  onSubmit: () => void;
  onSelectSuggestion: (cPhone: string) => void;
}

export function CustomerSearchCard({
  phone,
  loading,
  filteredCustomers,
  onPhoneChange,
  onSubmit,
  onSelectSuggestion,
}: CustomerSearchCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
      <h2 className="text-base sm:text-lg font-bold text-slate-900">
        Tra cứu Khách hàng theo Số Điện Thoại & Xuất Hóa Đơn PDF
      </h2>
      <p className="text-xs text-slate-500 mt-0.5">
        Nhập số điện thoại khách hàng để xem toàn bộ lịch sử mua hàng, phiếu trả/đổi và in lại hóa đơn.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
      >
        <div className="relative w-full sm:flex-1 sm:max-w-md">
          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="Nhập SĐT hoặc Tên khách hàng (VD: 0945 xxx xxx)..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow"
        >
          <Search className="w-4 h-4" />
          {loading ? "Đang tra cứu..." : "Tra cứu SĐT"}
        </button>
      </form>

      {filteredCustomers.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">
            {phone.trim() ? "Khách hàng khớp tìm kiếm:" : "Khách hàng gần đây:"}
          </span>
          {filteredCustomers.map((c) => {
            const cPhone = c.phone || c.customerPhone;
            const cName = c.fullName || c.name || c.customerName;
            return (
              <button
                key={c._id || cPhone}
                type="button"
                onClick={() => onSelectSuggestion(cPhone)}
                className="min-h-[36px] max-w-full truncate px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-brand-ink text-xs font-mono font-semibold text-slate-700 transition"
              >
                {cName} ({formatPhone(cPhone)})
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
