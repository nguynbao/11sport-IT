"use client";

import React, { useState, useEffect, useCallback } from "react";
import ExportExcelButton from "./ExportExcelButton";
import { exportProducts, exportInventoryReport, exportMovements, exportImports } from "@/lib/exports";
import {
  Product,
  Category,
  StockMovement,
  InventoryReportRow,
  apiRequest,
  formatVND,
  formatDateTime,
  generateProductCode,
} from "@/lib/api";
import {
  Package,
  BarChart3,
  BookOpen,
  Sliders,
  ClipboardList,
  Save,
  Plus,
  CheckCircle2,
  AlertCircle,
  Search,
} from "lucide-react";

type SubTab = "PRODUCTS" | "REPORT" | "MOVEMENTS" | "IMPORTS" | "ADJUSTMENT";

export default function InventoryModule() {
  const [subTab, setSubTab] = useState<SubTab>("PRODUCTS");

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [reportRows, setReportRows] = useState<InventoryReportRow[]>([]);
  const [importsList, setImportsList] = useState<any[]>([]);

  // Filter
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [movementType, setMovementType] = useState("");

  // Giá bán chỉnh sửa theo productId
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});

  // Tạo sản phẩm mới nhanh
  const [newProdName, setNewProdName] = useState("");
  const [newProdCatId, setNewProdCatId] = useState("");
  const [newProdUnit, setNewProdUnit] = useState("Cái");
  const [newProdPrice, setNewProdPrice] = useState<number>(0);

  // Lập phiếu điều chỉnh kho
  const [adjProductId, setAdjProductId] = useState("");
  const [adjQuantityChange, setAdjQuantityChange] = useState<number>(0);
  const [adjReason, setAdjReason] = useState("");

  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProductsAndCats = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (categoryId) q.set("categoryId", categoryId);
      if (search.trim()) q.set("search", search.trim());

      const [prodRes, catRes] = await Promise.all([
        apiRequest<Product[]>(`/products?${q.toString()}`),
        apiRequest<Category[]>("/categories"),
      ]);
      const pList = Array.isArray(prodRes.data) ? prodRes.data : [];
      const cList = Array.isArray(catRes.data) ? catRes.data : [];
      setProducts(pList);
      setCategories(cList);

      const priceMap: Record<string, number> = {};
      pList.forEach((p) => {
        priceMap[p._id] = Number(p.sellingPrice || 0);
      });
      setEditingPrices(priceMap);

      if (cList.length > 0 && !newProdCatId) setNewProdCatId(cList[0]._id);
      if (pList.length > 0 && !adjProductId) setAdjProductId(pList[0]._id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [categoryId, search, newProdCatId, adjProductId]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set("from", fromDate);
      if (toDate) q.set("to", toDate);
      if (categoryId) q.set("categoryId", categoryId);
      const res = await apiRequest<any>(`/inventory/report?${q.toString()}`);
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.items || res.data?.rows || [];
      setReportRows(list);
    } catch {
      setReportRows([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, categoryId]);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (movementType) q.set("type", movementType);
      if (fromDate) q.set("from", fromDate);
      if (toDate) q.set("to", toDate);
      const res = await apiRequest<StockMovement[]>(
        `/inventory/movements?${q.toString()}`
      );
      setMovements(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [movementType, fromDate, toDate]);

  const loadImports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<any[]>("/imports");
      setImportsList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setImportsList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProductsAndCats();
  }, [loadProductsAndCats]);

  useEffect(() => {
    if (subTab === "REPORT") loadReport();
    if (subTab === "MOVEMENTS") loadMovements();
    if (subTab === "IMPORTS") loadImports();
  }, [subTab, loadReport, loadMovements, loadImports]);

  const handleUpdateSellingPrice = async (prod: Product) => {
    setStatusMsg(null);
    const newPrice = Number(editingPrices[prod._id] ?? prod.sellingPrice);
    if (newPrice < 0) {
      setStatusMsg({ type: "error", text: "Giá bán không được âm." });
      return;
    }
    try {
      await apiRequest(`/products/${prod._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: prod.name,
          unit: prod.unit,
          sellingPrice: newPrice,
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã cập nhật giá bán cho "${prod.name}" thành ${formatVND(newPrice)}!`,
      });
      loadProductsAndCats();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Lỗi khi cập nhật giá bán sản phẩm.",
      });
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!newProdName.trim()) return;
    try {
      await apiRequest("/products", {
        method: "POST",
        body: JSON.stringify({
          name: newProdName.trim(),
          categoryId: newProdCatId,
          unit: newProdUnit,
          sellingPrice: Number(newProdPrice || 0),
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã tạo sản phẩm mới với mã tự sinh "${generateProductCode(
          newProdName
        )}" thành công!`,
      });
      setNewProdName("");
      loadProductsAndCats();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể tạo sản phẩm mới.",
      });
    }
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!adjProductId || adjQuantityChange === 0 || !adjReason.trim()) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng chọn sản phẩm, nhập số lượng điều chỉnh khác 0 và lý do điều chỉnh.",
      });
      return;
    }
    try {
      await apiRequest("/inventory/adjustments", {
        method: "POST",
        body: JSON.stringify({
          productId: adjProductId,
          quantityChange: Number(adjQuantityChange),
          reason: adjReason.trim(),
        }),
      });
      setStatusMsg({
        type: "success",
        text: "Đã lập Phiếu Điều Chỉnh Kho thành công! Tồn kho và Sổ kho đã được cập nhật.",
      });
      loadProductsAndCats();
      loadMovements();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Lỗi khi lập phiếu điều chỉnh kho.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Thanh chuyển Sub-Tab trong Module Kho */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSubTab("PRODUCTS")}
          className={`px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-2 transition ${
            subTab === "PRODUCTS"
              ? "bg-slate-900 text-white shadow"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Package className="w-4 h-4 text-emerald-400" />
          1. Sản phẩm & Cập nhật Giá bán
        </button>

        <button
          type="button"
          onClick={() => setSubTab("REPORT")}
          className={`px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-2 transition ${
            subTab === "REPORT"
              ? "bg-slate-900 text-white shadow"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          2. Báo cáo Tồn kho theo kỳ (Đầu kỳ / Cuối kỳ)
        </button>

        <button
          type="button"
          onClick={() => setSubTab("MOVEMENTS")}
          className={`px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-2 transition ${
            subTab === "MOVEMENTS"
              ? "bg-slate-900 text-white shadow"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-400" />
          3. Sổ kho (Stock Movements)
        </button>

        <button
          type="button"
          onClick={() => setSubTab("IMPORTS")}
          className={`px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-2 transition ${
            subTab === "IMPORTS"
              ? "bg-slate-900 text-white shadow"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ClipboardList className="w-4 h-4 text-emerald-400" />
          4. Danh sách Phiếu nhập kho
        </button>

        <button
          type="button"
          onClick={() => setSubTab("ADJUSTMENT")}
          className={`px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-2 transition ${
            subTab === "ADJUSTMENT"
              ? "bg-slate-900 text-white shadow"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Sliders className="w-4 h-4 text-emerald-400" />
          5. Lập Phiếu Điều chỉnh Kho
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            statusMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* SUB-TAB 1: SẢN PHẨM & CẬP NHẬT GIÁ BÁN LẺ */}
      {subTab === "PRODUCTS" && (
        <div className="space-y-6">
          {/* Form tạo nhanh sản phẩm mới (Mã tự sinh từ ngoặc đơn) */}
          <form
            onSubmit={handleCreateProduct}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4"
          >
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              Thêm Sản phẩm mới (Tự sinh Mã sản phẩm từ `(...)` theo BR-03)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Tên hàng hóa (Có chứa ngoặc đơn) *
                </label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="VD: Áo Polo Unisex V1 (Áo Polo Unisex V1 KMAP26 Đỏ size L)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Mã tự sinh (Xem trước)
                </label>
                <input
                  type="text"
                  readOnly
                  value={generateProductCode(newProdName)}
                  placeholder="Tự động sinh..."
                  className="w-full px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 font-mono text-[11px] font-bold text-emerald-900"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Category
                </label>
                <select
                  value={newProdCatId}
                  onChange={(e) => setNewProdCatId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  + Tạo Sản Phẩm
                </button>
              </div>
            </div>
          </form>

          {/* Bảng danh sách sản phẩm & Cập nhật giá bán */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Danh mục Sản phẩm & Cập nhật Giá bán lẻ (BR-04)
                </h3>
                <p className="text-xs text-slate-500">
                  Sản phẩm mới tạo khi Nhập kho có giá bán mặc định = 0 ₫. Giá gốc do thủ kho nhập khi lập phiếu nhập; Quản lý/Admin tham khảo giá gốc và cập nhật giá bán lẻ tại đây để mở bán trên POS.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ExportExcelButton
                  onExport={() => exportProducts(products)}
                  disabled={products.length === 0}
                />
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm mã hoặc tên sản phẩm..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="">Tất cả Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase">
                  <tr>
                    <th className="py-3 px-3">Mã hàng (Không sửa)</th>
                    <th className="py-3 px-3">Tên sản phẩm</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-center">ĐVT</th>
                    <th className="py-3 px-3 text-right">Tồn kho (Sổ kho)</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Giá gốc (VND)</th>
                    <th className="py-3 px-3 text-right w-48">Giá bán lẻ (VND)</th>
                    <th className="py-3 px-3 text-right w-32">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {products.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        {p.code}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {p.name}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {p.categoryName ||
                          (typeof p.categoryId === "object" && p.categoryId?.name) ||
                          "-"}
                      </td>
                      <td className="py-3 px-3 text-center">{p.unit}</td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-700">
                        {p.stock}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        {Number(p.costPrice) > 0 ? (
                          formatVND(p.costPrice)
                        ) : (
                          <span className="text-slate-400">Chưa có</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={editingPrices[p._id] ?? p.sellingPrice}
                          onChange={(e) =>
                            setEditingPrices((prev) => ({
                              ...prev,
                              [p._id]: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className={`w-40 px-2.5 py-1.5 rounded border text-right font-mono font-bold ${
                            (editingPrices[p._id] ?? p.sellingPrice) === 0
                              ? "border-amber-400 bg-amber-50 text-amber-900"
                              : "border-slate-300 bg-white text-slate-900"
                          }`}
                        />
                        {(() => {
                          const sell = Number(editingPrices[p._id] ?? p.sellingPrice) || 0;
                          const cost = Number(p.costPrice) || 0;
                          if (sell <= 0 || cost <= 0) return null;
                          const margin = sell - cost;
                          return (
                            <div
                              className={`mt-1 text-[10px] font-bold ${
                                margin < 0 ? "text-red-600" : "text-emerald-700"
                              }`}
                            >
                              {margin < 0 ? "Lỗ" : "Lãi"}: {formatVND(Math.abs(margin))} (
                              {Math.round((margin / cost) * 100)}%)
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleUpdateSellingPrice(p)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" /> Lưu giá
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BÁO CÁO TỒN KHO THEO KỲ (TỒN ĐẦU KỲ / CUỐI KỲ) */}
      {subTab === "REPORT" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Báo cáo Kế toán Tồn kho theo kỳ (BR-06)
              </h3>
              <p className="text-xs text-slate-500">
                Công thức chuẩn:{" "}
                <strong className="text-slate-800">
                  Tồn cuối kỳ = Tồn đầu kỳ + Nhập trong kỳ − Bán trong kỳ ± Điều chỉnh
                </strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
              <span className="text-xs text-slate-400">đến</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
              <button
                type="button"
                onClick={loadReport}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold"
              >
                Lọc kỳ báo cáo
              </button>
              <ExportExcelButton
                onExport={() => exportInventoryReport(reportRows, fromDate, toDate)}
                disabled={reportRows.length === 0}
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white uppercase">
                <tr>
                  <th className="py-3 px-3">Mã sản phẩm</th>
                  <th className="py-3 px-3">Tên sản phẩm</th>
                  <th className="py-3 px-3 text-center">ĐVT</th>
                  <th className="py-3 px-3 text-right">Tồn Đầu Kỳ</th>
                  <th className="py-3 px-3 text-right text-emerald-300">
                    + Nhập Trong Kỳ
                  </th>
                  <th className="py-3 px-3 text-right text-amber-300">
                    − Bán Trong Kỳ
                  </th>
                  <th className="py-3 px-3 text-right text-blue-300">
                    ± Trả/Đổi/Điều Chỉnh
                  </th>
                  <th className="py-3 px-3 text-right font-extrabold bg-slate-800">
                    = Tồn Cuối Kỳ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reportRows.map((r, i) => (
                  <tr key={r.productId || i} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold">{r.productCode}</td>
                    <td className="py-3 px-3 font-semibold">{r.productName}</td>
                    <td className="py-3 px-3 text-center">{r.unit}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      {r.openingStock}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                      +{r.importedQty}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-700">
                      -{r.soldQty}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-blue-700">
                      {r.adjustedAndReturnedQty > 0
                        ? `+${r.adjustedAndReturnedQty}`
                        : r.adjustedAndReturnedQty}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 bg-slate-50">
                      {r.closingStock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SỔ KHO (STOCK MOVEMENTS) */}
      {subTab === "MOVEMENTS" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Sổ Kho Kế Toán (Stock Movements — BR-07)
              </h3>
              <p className="text-xs text-slate-500">
                Lưu vết toàn bộ lịch sử biến động tồn kho kèm mã chứng từ tham chiếu và nhân viên thực hiện.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
            <ExportExcelButton
              onExport={() => exportMovements(movements, movementType)}
              disabled={movements.length === 0}
            />
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
            >
              <option value="">Tất cả loại giao dịch</option>
              <option value="IMPORT">IMPORT (Nhập kho)</option>
              <option value="SALE">SALE (Bán hàng)</option>
              <option value="RETURN">RETURN (Trả hàng)</option>
              <option value="EXCHANGE_IN">EXCHANGE_IN (Nhận hàng đổi)</option>
              <option value="EXCHANGE_OUT">EXCHANGE_OUT (Xuất hàng đổi)</option>
              <option value="ADJUSTMENT">ADJUSTMENT (Điều chỉnh kho)</option>
            </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white uppercase">
                <tr>
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3">Loại</th>
                  <th className="py-3 px-3">Sản phẩm</th>
                  <th className="py-3 px-3 text-right">Biến động</th>
                  <th className="py-3 px-3 text-right">Tồn sau GD</th>
                  <th className="py-3 px-3">Chứng từ</th>
                  <th className="py-3 px-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {movements.map((m) => (
                  <tr key={m._id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-500">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">{m.type}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{m.productName}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {m.productCode}
                      </div>
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-extrabold ${
                        m.quantityChange > 0 ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      {m.balanceAfter}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-blue-700">
                      {m.referenceCode || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{m.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: DANH SÁCH PHIẾU NHẬP KHO */}
      {subTab === "IMPORTS" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-slate-900 text-base">
              Danh sách Phiếu Nhập Kho (BR-09, BR-10)
            </h3>
            <ExportExcelButton
              label="Xuất Excel (kèm chi tiết hàng)"
              onExport={() => exportImports(importsList)}
              disabled={importsList.length === 0}
            />
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white uppercase">
                <tr>
                  <th className="py-3 px-3">Mã Phiếu</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-3">Số dòng hàng</th>
                  <th className="py-3 px-3 text-right">Tổng giá gốc</th>
                  <th className="py-3 px-3">Ghi chú</th>
                  <th className="py-3 px-3">Ngày tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {importsList.map((imp) => (
                  <tr key={imp._id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold">
                      {imp.code || imp.receiptCode || imp._id}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          imp.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : imp.status === "CHECKING"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {imp.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold">
                      {imp.items?.length || 0} mặt hàng
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      {formatVND(
                        (imp.items || []).reduce(
                          (sum: number, it: any) =>
                            sum + (Number(it.costPrice) || 0) * (Number(it.actualQuantity) || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="py-3 px-3">{imp.note || "-"}</td>
                    <td className="py-3 px-3 text-slate-500">
                      {formatDateTime(imp.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: LẬP PHIẾU ĐIỀU CHỈNH KHO */}
      {subTab === "ADJUSTMENT" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-2xl">
          <h3 className="font-bold text-slate-900 text-base">
            Lập Phiếu Điều Chỉnh Kho (BR-10)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Vì Phiếu nhập kho đã hoàn thành không được sửa trực tiếp, Quản lý sử dụng chức năng này để điều chỉnh tăng/giảm tồn kho thực tế và tự động ghi vết vào Sổ kho.
          </p>

          <form onSubmit={handleCreateAdjustment} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Chọn Sản phẩm cần điều chỉnh *
              </label>
              <select
                value={adjProductId}
                onChange={(e) => setAdjProductId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
              >
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.code}) — Tồn hiện tại: {p.stock} {p.unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Số lượng điều chỉnh (Nhập số dương + để tăng, số âm - để giảm) *
              </label>
              <input
                type="number"
                required
                value={adjQuantityChange}
                onChange={(e) => setAdjQuantityChange(Number(e.target.value))}
                className="w-48 px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-base font-extrabold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Lý do điều chỉnh kho (Bắt buộc ghi rõ mã phiếu/biên bản) *
              </label>
              <input
                type="text"
                required
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="VD: Kiểm kê lệch phiếu nhập PN-0001..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow"
            >
              Xác nhận Điều chỉnh Kho & Ghi Sổ Kho
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
