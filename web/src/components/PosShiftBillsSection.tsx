"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Order,
  CurrentShiftOrdersMeta,
  fetchCurrentShiftOrdersApi,
  formatVND,
  formatDateTime,
  formatPhone,
  useDebounce,
} from "@/lib/api";
import {
  FileText,
  Search,
  Printer,
  RefreshCw,
  Clock,
  ShieldAlert,
  Banknote,
  Landmark,
  CreditCard,
  ShoppingBag,
  Eye,
  X,
  User,
  Tag,
  Gift,
  Layers,
} from "lucide-react";

interface PosShiftBillsSectionProps {
  onOpenInvoice: (order: Order) => void;
  onMetaChange?: (meta: CurrentShiftOrdersMeta) => void;
  refreshTrigger?: number;
}

function getLocalDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getRecentQuickDates(days = 3): string[] {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(base);
    dt.setDate(base.getDate() - i);
    dates.push(getLocalDateStr(dt));
  }
  return dates;
}

function formatShortVnDate(dateStr?: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatPaymentMethodLabel(ord: Order): string {
  if (ord.paymentMethod === "CASH") return "Tiền mặt";
  if (ord.paymentMethod === "BANKING") return "Chuyển khoản";
  if (ord.paymentMethod === "CARD") {
    return ord.cardFeePercent ? `Quẹt thẻ (${ord.cardFeePercent}%)` : "Quẹt thẻ";
  }
  return ord.paymentMethodDetail || "Tách TT / Khác";
}

function formatShiftBadge(shiftCode?: string): string {
  if (shiftCode === "SHIFT_1") return "Ca 1 (08:30 - 17:30)";
  if (shiftCode === "SHIFT_2") return "Ca 2 (12:00 - 21:00)";
  if (shiftCode === "BOTH") return "Ca 1 + Ca 2";
  if (shiftCode === "OFF") return "Nghỉ (OFF)";
  return "Trong ngày";
}

export default function PosShiftBillsSection({
  onOpenInvoice,
  onMetaChange,
  refreshTrigger = 0,
}: PosShiftBillsSectionProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<CurrentShiftOrdersMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<string>(() => getLocalDateStr());
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const currentDayRef = useRef<string>(getLocalDateStr());
  const quickDates = getRecentQuickDates(3);
  const maxDate = meta?.maxDate || getLocalDateStr();

  const loadShiftBills = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetchCurrentShiftOrdersApi({
        search: debouncedSearch,
        status: statusFilter,
        paymentMethod: paymentFilter,
        date: dateFilter,
        shiftCode: shiftFilter,
      });
      setOrders(res.orders);
      setMeta(res.meta);
      if (onMetaChange) {
        onMetaChange(res.meta);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tải danh sách bill trong ngày");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, paymentFilter, dateFilter, shiftFilter, onMetaChange]);

  useEffect(() => {
    loadShiftBills();
  }, [loadShiftBills, refreshTrigger]);

  // Tự động kiểm tra khi qua 00:00 sang ngày mới -> cập nhật lại mốc ngày hiện tại
  useEffect(() => {
    const timer = setInterval(() => {
      const today = getLocalDateStr();
      if (today !== currentDayRef.current) {
        const prevToday = currentDayRef.current;
        currentDayRef.current = today;
        setDetailOrder(null);
        if (dateFilter === prevToday) {
          setDateFilter(today);
        } else {
          loadShiftBills();
        }
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [loadShiftBills, dateFilter]);

  const summary = meta?.summary || {
    paidOrdersCount: 0,
    draftOrdersCount: 0,
    totalRevenue: 0,
    cashTotal: 0,
    bankingTotal: 0,
    cardTotal: 0,
    debtTotal: 0,
  };

  return (
    <div className="space-y-4">
      {/* Banner thông tin Tra cứu Lịch sử Bill (không giới hạn ca hay số ngày) */}
      <div className="bg-white text-slate-900 rounded-xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-brand-ink text-xs font-extrabold">
              <Clock className="w-3.5 h-3.5" />
              {meta?.shiftLabel || "Cả ngày (Mọi ca)"}
            </span>
            <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {dateFilter === "ALL"
                ? "Tất cả các ngày"
                : `Ngày: ${formatShortVnDate(dateFilter || meta?.date || getLocalDateStr())}`}
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
            Lịch sử Hoá đơn (Tra cứu Bill mọi ngày &amp; mọi ca)
          </h2>
          <p className="text-xs text-slate-600 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-brand-ink shrink-0" />
            <span>
              Tra cứu toàn bộ đơn hàng, Chọn ngày bất kỳ hoặc bấm <strong>Tất cả</strong> để xem toàn bộ lịch sử bill.
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {quickDates.map((dStr, idx) => {
            const label =
              idx === 0
                ? `Hôm nay (${dStr.slice(8, 10)}/${dStr.slice(5, 7)})`
                : idx === 1
                  ? `Hôm qua (${dStr.slice(8, 10)}/${dStr.slice(5, 7)})`
                  : `2 ngày trước (${dStr.slice(8, 10)}/${dStr.slice(5, 7)})`;
            const active = dateFilter === dStr;
            return (
              <button
                key={dStr}
                type="button"
                onClick={() => setDateFilter(dStr)}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${active
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  }`}
              >
                {label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setDateFilter("ALL")}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${dateFilter === "ALL"
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={loadShiftBills}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-ink" : "text-brand-ink"}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Thẻ tổng hợp nhanh Bill trong ngày */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Số Bill đã thanh toán</span>
            <ShoppingBag className="w-4 h-4 text-brand-ink" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-mono font-black text-slate-900">
              {summary.paidOrdersCount}
            </span>
            <span className="text-xs text-slate-500 font-semibold">bill</span>
            {summary.draftOrdersCount > 0 && (
              <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                +{summary.draftOrdersCount} nháp
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-blue-200 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-brand-ink font-semibold">
            <span>{dateFilter === "ALL" ? "Tổng tiền Bill (Tất cả)" : "Tổng tiền Bill trong ngày"}</span>
            <FileText className="w-4 h-4 text-brand-ink" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-mono font-black text-brand-ink break-all">
            {formatVND(summary.totalRevenue)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-amber-900 font-semibold">
            <span>{dateFilter === "ALL" ? "Thực thu Tiền mặt (Tất cả)" : "Thực thu Tiền mặt trong ngày"}</span>
            <Banknote className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-mono font-black text-amber-700 break-all">
            {formatVND(summary.cashTotal)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-indigo-200 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-indigo-900 font-semibold">
            <span>{dateFilter === "ALL" ? "Chuyển khoản (Tất cả)" : "Chuyển khoản trong ngày"}</span>
            <Landmark className="w-4 h-4 text-brand-ink" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-mono font-black text-brand-ink break-all">
            {formatVND(summary.bankingTotal)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-purple-200 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-purple-900 font-semibold">
            <span>{dateFilter === "ALL" ? "Quẹt thẻ (Tất cả)" : "Quẹt thẻ trong ngày"}</span>
            <CreditCard className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-mono font-black text-purple-700 break-all">
            {formatVND(summary.cardTotal)}
          </div>
        </div>
      </div>

      {/* Bộ lọc & Tìm kiếm Bill trong ngày */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
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

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Danh sách Bill */}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Đang tải danh sách bill trong ngày...
          </div>
        ) : orders.length === 0 ? (
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
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full min-w-[920px] text-xs sm:text-sm text-left">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-3.5">Mã Bill</th>
                  <th className="py-3 px-3.5">Giờ tạo / Ca</th>
                  <th className="py-3 px-3.5">Khách hàng</th>
                  <th className="py-3 px-3.5">Sản phẩm trong Bill</th>
                  <th className="py-3 px-3.5">Thanh toán</th>
                  <th className="py-3 px-3.5 text-right">Tổng tiền</th>
                  <th className="py-3 px-3.5 text-center">Trạng thái</th>
                  <th className="py-3 px-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((ord) => {
                  const code = ord.orderCode || ord.code || "";
                  const totalUnits = (ord.items || []).reduce(
                    (s, it) => s + (Number(it.quantity) || 0),
                    0
                  );
                  const debtAmt = Math.max(0, Number(ord.debtAmount) || 0);
                  return (
                    <tr key={ord._id} className="hover:bg-slate-50/90 transition">
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-mono font-black text-slate-900 text-sm">
                          {code}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          NV: {ord.confirmedByName || ord.createdByName || "Sales"}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-slate-800">
                          {formatDateTime(ord.confirmedAt || ord.createdAt)}
                        </div>
                        <span className="inline-block mt-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-50 text-brand-ink border border-blue-200">
                          {formatShiftBadge(ord.shiftCode)}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">
                          {ord.customerName || "Khách lẻ"}
                        </div>
                        {ord.customerPhone && (
                          <div className="font-mono text-xs text-slate-500">
                            {formatPhone(ord.customerPhone)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5 max-w-xs">
                        <div className="space-y-0.5">
                          {(ord.items || []).slice(0, 3).map((it, idx) => (
                            <div key={idx} className="text-xs text-slate-800 truncate">
                              • {it.productName}{" "}
                              <strong className="font-mono">×{it.quantity}</strong>
                              {(it.isGift || it.discountType === "GIFT") && (
                                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                  🎁 Tặng
                                </span>
                              )}
                            </div>
                          ))}
                          {(ord.items || []).length > 3 && (
                            <div className="text-[11px] font-semibold text-brand-ink">
                              +{(ord.items || []).length - 3} dòng sản phẩm khác (Tổng {totalUnits} SP)
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-800">
                          {ord.paymentMethod === "CASH" && (
                            <Banknote className="w-3.5 h-3.5 text-brand-ink" />
                          )}
                          {ord.paymentMethod === "BANKING" && (
                            <Landmark className="w-3.5 h-3.5 text-brand-ink" />
                          )}
                          {ord.paymentMethod === "CARD" && (
                            <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          {ord.paymentMethod === "OTHER" && (
                            <Layers className="w-3.5 h-3.5 text-brand-ink" />
                          )}
                          {formatPaymentMethodLabel(ord)}
                        </span>
                        {ord.cardFee > 0 && (
                          <div className="text-[10px] font-mono text-amber-700">
                            Phí thẻ: +{formatVND(ord.cardFee)}
                          </div>
                        )}
                        {debtAmt > 0 && (
                          <div className="text-[10px] font-mono font-bold text-red-600">
                            Nợ: {formatVND(debtAmt)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="font-mono font-black text-brand-ink text-sm">
                          {formatVND(ord.totalAmount)}
                        </div>
                        {((ord.itemDiscountTotal || 0) > 0 ||
                          (ord.billDiscountAmount || 0) > 0) && (
                            <div className="text-[10px] font-mono text-rose-600">
                              Giảm: −
                              {formatVND(
                                (Number(ord.itemDiscountTotal) || 0) +
                                (Number(ord.billDiscountAmount) || 0)
                              )}
                            </div>
                          )}
                      </td>

                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${ord.status === "DRAFT"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : ord.status === "PAID"
                              ? "bg-blue-100 text-brand-ink"
                              : ord.status === "PARTIALLY_RETURNED"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-red-100 text-red-700"
                            }`}
                        >
                          {ord.status === "DRAFT"
                            ? "Bản nháp"
                            : ord.status === "PAID"
                              ? "Đã TT"
                              : ord.status === "PARTIALLY_RETURNED"
                                ? "Trả 1 phần"
                                : "Đã trả hết"}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailOrder(ord)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                            title="Xem chi tiết Bill"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Chi tiết</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenInvoice(ord)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition cursor-pointer"
                            title="In hoặc xuất PDF hóa đơn (K80)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>In Bill</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Xem Chi Tiết Bill Trong Ca */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-base text-blue-400">
                    Bill {detailOrder.orderCode || detailOrder.code}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white/15 text-white">
                    {formatShiftBadge(detailOrder.shiftCode)}
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Thời gian: {formatDateTime(detailOrder.confirmedAt || detailOrder.createdAt)} ·
                  NV: {detailOrder.confirmedByName || detailOrder.createdByName || "Sales"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-blue-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-start gap-2.5">
                  <User className="w-4 h-4 text-brand-ink mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] text-slate-500 font-semibold uppercase">
                      Khách hàng
                    </div>
                    <div className="font-bold text-slate-900">
                      {detailOrder.customerName || "Khách lẻ"}
                    </div>
                    <div className="font-mono text-xs text-slate-600">
                      SĐT: {formatPhone(detailOrder.customerPhone)}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 font-semibold uppercase">
                    Hình thức thanh toán
                  </div>
                  <div className="font-bold text-slate-900">
                    {formatPaymentMethodLabel(detailOrder)}
                  </div>
                  {detailOrder.note && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      Ghi chú: {detailOrder.note}
                    </div>
                  )}
                </div>
              </div>

              {/* Danh sách mặt hàng trong Bill */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Sản phẩm</th>
                      <th className="py-2.5 px-3 text-center">SL</th>
                      <th className="py-2.5 px-3 text-right">Đơn giá</th>
                      <th className="py-2.5 px-3 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(detailOrder.items || []).map((it, idx) => {
                      const isGift = Boolean(it.isGift) || it.discountType === "GIFT";
                      const origPrice = Number(it.originalUnitPrice ?? it.unitPrice) || 0;
                      const hasDisc = !isGift && origPrice > Number(it.unitPrice);
                      return (
                        <tr key={idx}>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{it.productName}</span>
                              {isGift && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                                  <Gift className="w-3 h-3" /> Hàng tặng (0đ)
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              Mã: {it.productCode}
                              {(it.returnedQuantity || 0) > 0 && (
                                <span className="ml-2 text-rose-600 font-bold">
                                  (Đã trả: {it.returnedQuantity})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {isGift ? (
                              <span className="text-amber-700 font-bold">0 VND</span>
                            ) : hasDisc ? (
                              <div>
                                <div className="line-through text-slate-400 text-[11px]">
                                  {formatVND(origPrice)}
                                </div>
                                <div className="font-bold text-brand-ink">
                                  {formatVND(it.unitPrice)}
                                </div>
                              </div>
                            ) : (
                              <span>{formatVND(it.unitPrice)}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900">
                            {formatVND(it.lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tổng kết tiền trên Bill */}
              <div className="bg-blue-50/70 border border-blue-200 text-slate-800 p-4 rounded-xl space-y-1.5 text-xs">
                {detailOrder.rawSubtotal !== undefined && detailOrder.rawSubtotal > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tổng tiền hàng (giá niêm yết):</span>
                    <span className="font-mono">{formatVND(detailOrder.rawSubtotal)}</span>
                  </div>
                )}
                {(detailOrder.itemDiscountTotal || 0) > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Giảm giá trên sản phẩm:
                    </span>
                    <span className="font-mono">
                      −{formatVND(detailOrder.itemDiscountTotal || 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>Tạm tính (Subtotal):</span>
                  <span className="font-mono">{formatVND(detailOrder.subtotal)}</span>
                </div>
                {(detailOrder.billDiscountAmount || 0) > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Giảm giá tổng Bill:</span>
                    <span className="font-mono">
                      −{formatVND(detailOrder.billDiscountAmount || 0)}
                    </span>
                  </div>
                )}
                {detailOrder.cardFee > 0 && (
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>Phí quẹt thẻ ({detailOrder.cardFeePercent || 1.8}%):</span>
                    <span className="font-mono">+{formatVND(detailOrder.cardFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-blue-200 text-brand-ink">
                  <span>TỔNG THANH TOÁN:</span>
                  <span className="font-mono text-base">
                    {formatVND(detailOrder.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDetailOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const ord = detailOrder;
                  setDetailOrder(null);
                  onOpenInvoice(ord);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>In / Xuất Hóa Đơn PDF (K80)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
