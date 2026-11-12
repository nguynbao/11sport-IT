"use client";

import React, { useState, useEffect } from "react";
import {
  StaffUser,
  DailyHandoverCheckData,
  DailyHandoverProductItem,
  fetchDailyHandoverCheckApi,
  createHandoverApi,
} from "@/lib/api";
import {
  Boxes,
  AlertCircle,
  Coins,
  Send,
  X,
  Search,
  Plus,
  Minus,
  Shuffle,
  CheckCircle2,
} from "lucide-react";

interface Props {
  currentUser: StaffUser | null;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH";
  onClose: () => void;
  onSuccess: () => void;
}

function formatMoneyInput(val: number | string | undefined | null): string {
  if (val === 0 || val === "0") return "0";
  const digits = String(val ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "0";
  return Number(digits).toLocaleString("vi-VN");
}

function parseMoneyInput(raw: string): number {
  const digits = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return 0;
  return Number(digits) || 0;
}

export default function ShiftHandoverModal({
  currentUser: _currentUser,
  shiftCode = "SHIFT_1",
  onClose,
  onSuccess,
}: Props) {
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [note, setNote] = useState("");
  const [dailyCheck, setDailyCheck] = useState<DailyHandoverCheckData | null>(null);
  const [products, setProducts] = useState<DailyHandoverProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("ALL");
  const [errorMsg, setErrorMsg] = useState("");

  // Tồn thực tế đếm được (mặc định bằng tồn tầng 1)
  const [actualCounts, setActualCounts] = useState<{ [code: string]: number }>({});
  const [itemNotes, setItemNotes] = useState<{ [code: string]: string }>({});

  useEffect(() => {
    loadDailyCheckProducts();
  }, []);

  const loadDailyCheckProducts = async () => {
    setLoading(true);
    try {
      const data = await fetchDailyHandoverCheckApi();
      setDailyCheck(data);
      const list = Array.isArray(data.products) ? data.products : [];
      setProducts(list);

      const initialCounts: { [code: string]: number } = {};
      list.forEach((p) => {
        initialCounts[p.code] = p.stockQtyFloor1;
      });
      setActualCounts(initialCounts);
    } catch {
      setErrorMsg("Không thể tải danh mục kiểm hàng bàn giao ca hôm nay");
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustCount = (code: string, delta: number) => {
    setActualCounts((prev) => {
      const current = prev[code] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [code]: next };
    });
  };

  const handleDirectCountChange = (code: string, rawVal: string) => {
    const cleaned = rawVal.replace(/\D/g, "");
    const num = cleaned === "" ? 0 : Math.max(0, Number(cleaned));
    setActualCounts((prev) => ({ ...prev, [code]: num }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      const discrepancies: Array<{
        productCode: string;
        productName: string;
        categoryName: string;
        expected: number;
        actual: number;
        note?: string;
      }> = [];

      products.forEach((p) => {
        const expected = p.stockQtyFloor1;
        const actual = actualCounts[p.code] ?? expected;
        if (actual !== expected) {
          const customNote = (itemNotes[p.code] || "").trim();
          const defaultNote =
            actual > expected ? `Thừa ${actual - expected}` : `Thiếu ${expected - actual}`;
          discrepancies.push({
            productCode: p.code,
            productName: p.name,
            categoryName: p.categoryName,
            expected,
            actual,
            note: customNote ? `${defaultNote} (${customNote})` : defaultNote,
          });
        }
      });

      await createHandoverApi({
        date: dailyCheck?.date,
        shiftCode,
        cashBalance: Number(cashBalance) || 0,
        checkedCategories: dailyCheck?.checkedCategories || [],
        totalCheckedProducts: products.length,
        discrepancies,
        notes: note.trim(),
      });

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi gửi biên bản bàn giao");
    } finally {
      setSubmitting(false);
    }
  };

  const diffCount = products.filter((p) => (actualCounts[p.code] ?? p.stockQtyFloor1) !== p.stockQtyFloor1).length;

  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.categoryName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchSearch) return false;

    if (activeCategoryFilter === "DIFF_ONLY") {
      return (actualCounts[p.code] ?? p.stockQtyFloor1) !== p.stockQtyFloor1;
    }
    if (activeCategoryFilter !== "ALL") {
      return p.categoryName === activeCategoryFilter;
    }
    return true;
  });

  const checkedCategories = dailyCheck?.checkedCategories || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-slate-900">
      <div className="bg-white text-slate-900 rounded-3xl max-w-2xl w-full max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Lập Phiếu Kết Ca & Bàn Giao Kho Tầng 1</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {shiftCode === "BOTH"
                  ? "Ca 1 + Ca 2 (08:30 - 21:00) chốt két & lập phiếu bàn giao cho Ca 1 sáng hôm sau"
                  : shiftCode === "SHIFT_2"
                  ? "Ca 2 (12:00 - 21:00) chốt két & lập phiếu bàn giao cho Ca 1 sáng hôm sau"
                  : "Ca 1 (08:30 - 17:30) lập phiếu bàn giao sang cho Ca 2 xác nhận"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Bước 1: Tiền mặt trong két */}
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <Coins className="w-4 h-4 text-amber-600" />
              Bước 1: Chốt Két Tiền Mặt Bàn Giao
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiền mặt thực tế đếm trong két (VND) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={formatMoneyInput(cashBalance)}
                  onChange={(e) => setCashBalance(parseMoneyInput(e.target.value))}
                  placeholder="VD: 5.000.000..."
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú bàn giao ca</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: Tiền lẻ quầy 500k, dặn Ca 2 giao đơn khách..."
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Bước 2: Kiểm đếm Kho Tầng 1 theo Danh mục Random trong ngày */}
          <div className="space-y-3">
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-950 font-extrabold text-sm">
                  <Shuffle className="w-4 h-4 text-emerald-600" />
                  <span>
                    Bước 2: Kiểm Hàng Kết Ca Theo Ngày ({dailyCheck?.date || "Hôm nay"})
                  </span>
                </div>
                <p className="text-xs text-emerald-800">
                  Danh mục kiểm định kỳ hôm nay (luôn gồm <b>Vợt</b> + 1 nhóm ngẫu nhiên theo ngày):
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {checkedCategories.length > 0 ? (
                  checkedCategories.map((cat, idx) => (
                    <React.Fragment key={cat}>
                      {idx > 0 && <span className="text-xs font-black text-emerald-700">+</span>}
                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-extrabold border shadow-2xs ${
                          idx === 0
                            ? "bg-emerald-600 text-white border-emerald-700"
                            : "bg-white text-emerald-900 border-emerald-300"
                        }`}
                      >
                        {cat}
                      </span>
                    </React.Fragment>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">Đang tải danh mục...</span>
                )}
              </div>
            </div>

            {/* Bộ lọc nhóm & Tìm kiếm */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeCategoryFilter === "ALL"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Tất cả ({products.length})
                </button>
                {checkedCategories.map((cat) => {
                  const count = products.filter((p) => p.categoryName === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        activeCategoryFilter === cat
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
                {diffCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveCategoryFilter("DIFF_ONLY")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      activeCategoryFilter === "DIFF_ONLY"
                        ? "bg-amber-600 text-white"
                        : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                    }`}
                  >
                    Đang lệch ({diffCount})
                  </button>
                )}
              </div>

              <div className="relative sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm mã hoặc tên SP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Đang tải danh sách hàng Tầng 1 theo nhóm kiểm hôm nay...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                Không có sản phẩm nào khớp bộ lọc tại Kho Tầng 1.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const expected = p.stockQtyFloor1;
                  const actual = actualCounts[p.code] ?? expected;
                  const isDiff = actual !== expected;

                  return (
                    <div
                      key={p._id}
                      className={`p-3 flex flex-col gap-2 text-xs ${
                        isDiff ? "bg-amber-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                p.isPrimaryCategory
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-sky-100 text-sky-800"
                              }`}
                            >
                              {p.categoryName}
                            </span>
                            <span className="font-bold text-slate-900 truncate">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span className="font-mono font-semibold text-slate-500">{p.code}</span>
                            <span>•</span>
                            <span>ĐVT: {p.unit}</span>
                            {p.variants && p.variants.length > 1 && (
                              <>
                                <span>•</span>
                                <span className="truncate">
                                  {p.variants
                                    .map(
                                      (v) =>
                                        `${[v.color, v.size].filter(Boolean).join("/") || v.sku}: ${v.stockQtyFloor1}`
                                    )
                                    .join(", ")}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Tầng 1</span>
                            <span className="font-mono font-bold text-slate-700">{expected}</span>
                          </div>

                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => handleAdjustCount(p.code, -1)}
                              className="p-1 hover:bg-white rounded-lg text-slate-600 transition"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={actual}
                              onChange={(e) => handleDirectCountChange(p.code, e.target.value)}
                              className={`w-11 text-center font-mono font-bold bg-transparent outline-none ${
                                isDiff ? "text-amber-700" : "text-emerald-700"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleAdjustCount(p.code, 1)}
                              className="p-1 hover:bg-white rounded-lg text-slate-600 transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {isDiff && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] font-bold text-amber-800 shrink-0">
                            {actual > expected
                              ? `Thừa +${actual - expected} ${p.unit}`
                              : `Thiếu -${expected - actual} ${p.unit}`}
                            :
                          </span>
                          <input
                            type="text"
                            value={itemNotes[p.code] || ""}
                            onChange={(e) =>
                              setItemNotes((prev) => ({ ...prev, [p.code]: e.target.value }))
                            }
                            placeholder="Nhập lý do chênh lệch (VD: Hàng lỗi cất kho, khách đang xem...)"
                            className="flex-1 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-[11px] text-slate-800 outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Tổng số mã kiểm hôm nay: <b>{products.length}</b> sản phẩm (
                  {dailyCheck?.checkedCategoryLabel || "Vợt + Danh mục ngẫu nhiên"})
                </span>
              </div>
              <span className={diffCount > 0 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
                {diffCount > 0 ? `Phát hiện ${diffCount} mã lệch tồn` : "Khớp 100% tồn Tầng 1"}
              </span>
            </div>
          </div>

          {/* Footer nút bấm */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting
                ? "Đang lưu phiếu..."
                : shiftCode === "SHIFT_1"
                ? "Hoàn Tất Phiếu & Bàn Giao Ca 2"
                : "Hoàn Tất Phiếu & Bàn Giao Ca Sáng Hôm Sau"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
