"use client";

import React, { useState, useEffect } from "react";
import { StaffUser, Product, createHandoverApi, apiRequest } from "@/lib/api";
import {
  Boxes,
  CheckCircle2,
  AlertCircle,
  Coins,
  Send,
  X,
  Search,
  Plus,
  Minus,
} from "lucide-react";

interface Props {
  currentUser: StaffUser | null;
  shiftCode?: "SHIFT_1" | "SHIFT_2";
  onClose: () => void;
  onSuccess: () => void;
}

export default function ShiftHandoverModal({ currentUser, shiftCode = "SHIFT_1", onClose, onSuccess }: Props) {
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [note, setNote] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Tồn thực tế đếm được (mặc định bằng tồn tầng 1)
  const [actualCounts, setActualCounts] = useState<{ [code: string]: number }>({});

  useEffect(() => {
    loadFloor1Products();
  }, []);

  const loadFloor1Products = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<Product[]>("/products");
      const list = Array.isArray(res.data) ? res.data : [];
      // Lấy danh sách sản phẩm có ở Kho Tầng 1
      const floor1List = list.filter((p) => (p.stockFloor1 ?? p.stock) > 0);
      setProducts(floor1List);

      const initialCounts: { [code: string]: number } = {};
      floor1List.forEach((p) => {
        initialCounts[p.code] = p.stockFloor1 ?? p.stock;
      });
      setActualCounts(initialCounts);
    } catch {
      setErrorMsg("Không thể tải danh sách tồn Kho Tầng 1");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      // Tìm các sản phẩm có chênh lệch giữa thực tế và hệ thống
      const discrepancies: Array<{ productCode: string; expected: number; actual: number; note?: string }> = [];

      products.forEach((p) => {
        const expected = p.stockFloor1 ?? p.stock;
        const actual = actualCounts[p.code] ?? expected;
        if (actual !== expected) {
          discrepancies.push({
            productCode: p.code,
            expected,
            actual,
            note: actual > expected ? `Thừa ${actual - expected}` : `Thiếu ${expected - actual}`,
          });
        }
      });

      await createHandoverApi({
        shiftCode,
        cashBalance: Number(cashBalance) || 0,
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

  const filteredProducts = products.filter(
    (p) =>
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Kết Ca & Bàn Giao Kho Tầng 1</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {shiftCode === "SHIFT_2"
                  ? "Ca 2 (12:00 - 21:00) chốt két & đối soát Kho Tầng 1"
                  : "Ca 1 (08:30 - 17:30) bàn giao cho Ca 2"}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
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
                  type="number"
                  required
                  min={0}
                  value={cashBalance || ""}
                  onChange={(e) => setCashBalance(Number(e.target.value))}
                  placeholder="VD: 5000000..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú tiền bàn giao</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: Tiền lẻ quầy 500k, còn lại tiền thu ca..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Bước 2: Kiểm đếm Kho Tầng 1 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Boxes className="w-4 h-4 text-emerald-600" />
                Bước 2: Đối Soát Tồn Kho Tầng 1 (Showroom)
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                Mặc định: Khớp 100%
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Tìm nhanh mã hoặc tên sản phẩm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Đang tải danh sách hàng Tầng 1...</div>
            ) : products.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Không có sản phẩm nào tại Tầng 1.</div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const expected = p.stockFloor1 ?? p.stock;
                  const actual = actualCounts[p.code] ?? expected;
                  const isDiff = actual !== expected;

                  return (
                    <div
                      key={p._id}
                      className={`p-3 flex items-center justify-between gap-3 text-xs ${
                        isDiff ? "bg-amber-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{p.name}</div>
                        <div className="font-mono text-slate-400 text-[11px]">{p.code}</div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Hệ thống</span>
                          <span className="font-mono font-bold text-slate-700">{expected}</span>
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleAdjustCount(p.code, -1)}
                            className="p-1 hover:bg-white rounded-lg text-slate-600 transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span
                            className={`font-mono font-bold px-2 ${
                              isDiff ? "text-amber-700" : "text-emerald-700"
                            }`}
                          >
                            {actual}
                          </span>
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
                  );
                })}
              </div>
            )}
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
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? "Đang gửi biên bản..." : "Gửi Bàn Giao Cho Ca Sau"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
