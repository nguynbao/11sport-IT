"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Product, Category, apiRequest, formatVND, getStoredUser } from "@/lib/api";
import { Package, Layers, Search, Filter, RefreshCw } from "lucide-react";

export default function InventoryTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeWarehouse, setActiveWarehouse] = useState<"FLOOR_1" | "FLOOR_2" | "ALL">("FLOOR_1");
  const [floor1Codes, setFloor1Codes] = useState<Set<string>>(new Set());
  const [floor2Codes, setFloor2Codes] = useState<Set<string>>(new Set());

  // Saler (role SALES) chỉ được thấy Giá bán & Số lượng, KHÔNG được thấy Giá gốc
  const currentUser = getStoredUser();
  const canSeeCostPrice =
    currentUser?.role === "ADMIN" || currentUser?.role === "WAREHOUSE";

  const loadCategories = async () => {
    try {
      const res = await apiRequest<Category[]>("/categories");
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  };

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (selectedCategory) q.set("categoryId", selectedCategory);
      if (search.trim()) q.set("search", search.trim());
      const [res, impRes] = await Promise.all([
        apiRequest<Product[]>(`/products?${q.toString()}`),
        apiRequest<any[]>("/imports").catch(() => ({ data: [] as any[] })),
      ]);
      const list = Array.isArray(res.data) ? res.data : [];
      setProducts(list);
      setTotalProducts(res.meta?.totalProducts ?? list.length);
      setTotalStock(
        res.meta?.totalStock ?? list.reduce((sum, p) => sum + Number(p.stock || 0), 0)
      );

      const f1 = new Set<string>();
      const f2 = new Set<string>();
      (Array.isArray(impRes.data) ? impRes.data : []).forEach((imp: any) => {
        if (imp.status !== "COMPLETED") return;
        const wh = imp.targetWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1";
        (imp.items || []).forEach((it: any) => {
          if (wh === "FLOOR_2") f2.add(it.productCode);
          else f1.add(it.productCode);
        });
      });
      setFloor1Codes(f1);
      setFloor2Codes(f2);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, search]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const totalStockFloor1 = products.reduce((s, p) => s + (Number(p.stockFloor1 ?? p.stock) || 0), 0);
  const totalStockFloor2 = products.reduce((s, p) => s + (Number(p.stockFloor2) || 0), 0);

  const displayedProducts = products.filter((p) => {
    if (activeWarehouse === "FLOOR_1") {
      return (Number(p.stockFloor1 ?? p.stock) || 0) > 0 || floor1Codes.has(p.code) || !floor2Codes.has(p.code);
    }
    if (activeWarehouse === "FLOOR_2") {
      return (Number(p.stockFloor2) || 0) > 0 || floor2Codes.has(p.code);
    }
    return true;
  });

  const colCount = (canSeeCostPrice ? 8 : 7) + (activeWarehouse === "ALL" ? 2 : 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* BỘ CHUYỂN KHO TẦNG 1 & KHO TẦNG 2 */}
      <div className="bg-white rounded-xl border-2 border-slate-300 shadow-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Phân chia Quản lý 2 Kho độc lập
          </span>
          <h3 className="text-sm font-extrabold text-slate-900">
            Đang xem:{" "}
            {activeWarehouse === "FLOOR_1"
              ? "🏢 Kho Tầng 1 (Kho bán lẻ & trưng bày)"
              : activeWarehouse === "FLOOR_2"
              ? "🏬 Kho Tầng 2 (Kho dự trữ)"
              : "📊 Xem gộp cả 2 Kho (Tầng 1 + Tầng 2)"}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveWarehouse("FLOOR_1")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 border-2 ${
              activeWarehouse === "FLOOR_1"
                ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                : "bg-emerald-50/60 text-emerald-900 border-emerald-200 hover:bg-emerald-100"
            }`}
          >
            <span>🏢 KHO TẦNG 1</span>
            <span
              className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${
                activeWarehouse === "FLOOR_1" ? "bg-white text-emerald-800" : "bg-emerald-200 text-emerald-900"
              }`}
            >
              {totalStockFloor1.toLocaleString("vi-VN")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveWarehouse("FLOOR_2")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 border-2 ${
              activeWarehouse === "FLOOR_2"
                ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                : "bg-blue-50/60 text-blue-900 border-blue-200 hover:bg-blue-100"
            }`}
          >
            <span>🏬 KHO TẦNG 2</span>
            <span
              className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${
                activeWarehouse === "FLOOR_2" ? "bg-white text-blue-800" : "bg-blue-200 text-blue-900"
              }`}
            >
              {totalStockFloor2.toLocaleString("vi-VN")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveWarehouse("ALL")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 border-2 ${
              activeWarehouse === "ALL"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
            }`}
          >
            <span>📊 GỘP 2 KHO</span>
            <span
              className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${
                activeWarehouse === "ALL" ? "bg-white text-slate-900" : "bg-slate-200 text-slate-800"
              }`}
            >
              {totalStock.toLocaleString("vi-VN")}
            </span>
          </button>
        </div>
      </div>

      {/* Thẻ KPI Tổng số sản phẩm & Tổng tồn kho */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              {activeWarehouse === "FLOOR_1"
                ? "Số mặt hàng Kho Tầng 1"
                : activeWarehouse === "FLOOR_2"
                ? "Số mặt hàng Kho Tầng 2"
                : "Tổng số mặt hàng (SKU)"}
            </p>
            <p className="text-2xl md:text-3xl font-extrabold font-mono text-slate-900 mt-1">
              {displayedProducts.length}
            </p>
          </div>
          <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              {activeWarehouse === "FLOOR_1"
                ? "🏢 Tồn Kho Tầng 1"
                : activeWarehouse === "FLOOR_2"
                ? "🏬 Tồn Kho Tầng 2"
                : "Tổng tồn cả 2 kho"}
            </p>
            <p className="text-2xl md:text-3xl font-extrabold font-mono text-emerald-600 mt-1">
              {activeWarehouse === "FLOOR_1"
                ? totalStockFloor1
                : activeWarehouse === "FLOOR_2"
                ? totalStockFloor2
                : totalStock}
            </p>
          </div>
          <div className="w-12 h-12 shrink-0 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-xl p-4 md:p-5 shadow-sm flex flex-col justify-center sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-bold uppercase text-emerald-400">
            Quy tắc kế toán kho & Phân quyền giá (BR-04, BR-05)
          </p>
          <p className="text-xs text-slate-300 mt-1">
            {canSeeCostPrice
              ? "Tồn kho tự động tính từ Sổ kho (StockMovement). Bạn đang xem đầy đủ Số lượng, Giá gốc và Giá bán."
              : "Tồn kho tự động tính từ Sổ kho. Tài khoản Bán hàng (Saler) chỉ hiển thị Số lượng và Giá bán niêm yết (ẩn Giá gốc)."}
          </p>
        </div>
      </div>

      {/* Bộ lọc & Tìm kiếm */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo mã hàng hoặc tên hàng..."
                className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 shrink-0 text-slate-500" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="flex-1 sm:flex-none min-w-0 min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="">Tất cả Category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={loadInventory}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 self-stretch sm:self-start md:self-auto"
          >
            <RefreshCw className="w-4 h-4" /> Làm mới dữ liệu
          </button>
        </div>

        {/* Bảng tồn kho */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-full">
          <table className="w-full min-w-[760px] text-sm text-left">
            <thead className="bg-slate-900 text-white text-xs uppercase">
              <tr>
                <th className="py-3 px-4">STT</th>
                <th className="py-3 px-4">Mã sản phẩm (Code)</th>
                <th className="py-3 px-4">Tên hàng hóa</th>
                <th className="py-3 px-4">Danh mục (Category)</th>
                <th className="py-3 px-4 text-center">ĐVT</th>
                {(activeWarehouse === "FLOOR_1" || activeWarehouse === "ALL") && (
                  <th className="py-3 px-4 text-right text-emerald-300">🏢 Tồn Kho Tầng 1</th>
                )}
                {(activeWarehouse === "FLOOR_2" || activeWarehouse === "ALL") && (
                  <th className="py-3 px-4 text-right text-blue-300">🏬 Tồn Kho Tầng 2</th>
                )}
                {activeWarehouse === "ALL" && (
                  <th className="py-3 px-4 text-right">Tổng 2 Kho</th>
                )}
                {canSeeCostPrice && (
                  <th className="py-3 px-4 text-right">Giá gốc (VND)</th>
                )}
                <th className="py-3 px-4 text-right">Giá bán niêm yết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="py-10 text-center text-slate-500">
                    Đang tải dữ liệu tồn kho...
                  </td>
                </tr>
              ) : displayedProducts.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="py-10 text-center text-slate-500">
                    Không có mặt hàng nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                displayedProducts.map((p, idx) => {
                  const catName =
                    p.categoryName ||
                    (typeof p.categoryId === "object" && p.categoryId?.name) ||
                    "Mặc định";
                  const f1 = Number(p.stockFloor1 ?? p.stock) || 0;
                  const f2 = Number(p.stockFloor2) || 0;
                  return (
                    <tr key={p._id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-800 whitespace-nowrap">
                          {p.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{catName}</td>
                      <td className="py-3 px-4 text-center text-xs">{p.unit}</td>
                      {(activeWarehouse === "FLOOR_1" || activeWarehouse === "ALL") && (
                        <td className="py-3 px-4 text-right font-mono font-extrabold bg-emerald-50/30">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs ${
                              f1 > 0
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {f1}
                          </span>
                        </td>
                      )}
                      {(activeWarehouse === "FLOOR_2" || activeWarehouse === "ALL") && (
                        <td className="py-3 px-4 text-right font-mono font-extrabold bg-blue-50/30">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs ${
                              f2 > 0
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {f2}
                          </span>
                        </td>
                      )}
                      {activeWarehouse === "ALL" && (
                        <td className="py-3 px-4 text-right font-mono font-extrabold">
                          <span className="px-2.5 py-1 rounded-full text-xs bg-slate-200 text-slate-900">
                            {p.stock}
                          </span>
                        </td>
                      )}
                      {canSeeCostPrice && (
                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap text-amber-800 font-semibold">
                          {Number(p.costPrice) > 0 ? (
                            formatVND(p.costPrice)
                          ) : (
                            <span className="text-xs text-slate-400">Chưa có (0 VND)</span>
                          )}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        {p.sellingPrice > 0 ? (
                          <span className="font-bold text-slate-900">
                            {formatVND(p.sellingPrice)}
                          </span>
                        ) : (
                          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            Chưa cập nhật giá (0 VND)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
