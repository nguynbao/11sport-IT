"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Product, Category, apiRequest, formatVND } from "@/lib/api";
import { Package, Layers, Search, Filter, RefreshCw } from "lucide-react";

export default function InventoryTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [loading, setLoading] = useState(false);

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
      const res = await apiRequest<Product[]>(`/products?${q.toString()}`);
      const list = Array.isArray(res.data) ? res.data : [];
      setProducts(list);
      setTotalProducts(res.meta?.totalProducts ?? list.length);
      setTotalStock(
        res.meta?.totalStock ?? list.reduce((sum, p) => sum + Number(p.stock || 0), 0)
      );
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

  return (
    <div className="space-y-6">
      {/* Thẻ KPI Tổng số sản phẩm & Tổng tồn kho */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              Tổng số mặt hàng (SKU)
            </p>
            <p className="text-3xl font-extrabold font-mono text-slate-900 mt-1">
              {totalProducts}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              Tổng số lượng tồn kho hiện tại
            </p>
            <p className="text-3xl font-extrabold font-mono text-emerald-600 mt-1">
              {totalStock}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold uppercase text-emerald-400">
            Quy tắc kế toán kho (BR-05)
          </p>
          <p className="text-xs text-slate-300 mt-1">
            Tồn kho được tự động tính từ <strong>Sổ kho (StockMovement)</strong> qua Nhập kho,
            Bán hàng, Trả/Đổi và Điều chỉnh kho. Không sửa tay trực tiếp.
          </p>
        </div>
      </div>

      {/* Bộ lọc & Tìm kiếm */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo mã hàng hoặc tên hàng..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:border-emerald-600 focus:outline-none"
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
            className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 self-start"
          >
            <RefreshCw className="w-4 h-4" /> Làm mới dữ liệu
          </button>
        </div>

        {/* Bảng tồn kho */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900 text-white text-xs uppercase">
              <tr>
                <th className="py-3 px-4">STT</th>
                <th className="py-3 px-4">Mã sản phẩm (Code)</th>
                <th className="py-3 px-4">Tên hàng hóa</th>
                <th className="py-3 px-4">Danh mục (Category)</th>
                <th className="py-3 px-4 text-center">ĐVT</th>
                <th className="py-3 px-4 text-right">Giá bán niêm yết</th>
                <th className="py-3 px-4 text-right">Tồn kho hiện tại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Đang tải dữ liệu tồn kho...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Không có mặt hàng nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                products.map((p, idx) => {
                  const catName =
                    p.categoryName ||
                    (typeof p.categoryId === "object" && p.categoryId?.name) ||
                    "Mặc định";
                  return (
                    <tr key={p._id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-800">
                          {p.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{catName}</td>
                      <td className="py-3 px-4 text-center text-xs">{p.unit}</td>
                      <td className="py-3 px-4 text-right font-mono">
                        {p.sellingPrice > 0 ? (
                          <span className="font-bold text-slate-900">
                            {formatVND(p.sellingPrice)}
                          </span>
                        ) : (
                          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            Chưa cập nhật giá (0 ₫)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs ${
                            p.stock > 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {p.stock}
                        </span>
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
