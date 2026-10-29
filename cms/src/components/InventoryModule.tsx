"use client";

import React, { useState, useEffect, useCallback } from "react";
import ExportExcelButton from "./ExportExcelButton";
import {
  exportProducts,
  exportInventoryReport,
  exportMovements,
  exportImports,
} from "@/lib/exports";
import {
  Product,
  Category,
  StockMovement,
  InventoryReportRow,
  WarehouseFloor,
  apiRequest,
  formatVND,
  formatNumberDots,
  parseNumberDots,
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
  ChevronDown,
  ChevronUp,
  Trash2,
  ArrowLeftRight,
} from "lucide-react";

type SubTab = "PRODUCTS" | "REPORT" | "MOVEMENTS" | "IMPORTS" | "ADJUSTMENT" | "TRANSFER";

export default function InventoryModule() {
  const [subTab, setSubTab] = useState<SubTab>("PRODUCTS");

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [reportRows, setReportRows] = useState<InventoryReportRow[]>([]);
  const [importsList, setImportsList] = useState<any[]>([]);
  const [expandedImportId, setExpandedImportId] = useState<string | null>(null);

  // Filter
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [movementType, setMovementType] = useState("");

  // Tên, Category, ĐVT, Số lượng, Giá gốc & Giá bán chỉnh sửa theo productId
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [editingCats, setEditingCats] = useState<Record<string, string>>({});
  const [editingUnits, setEditingUnits] = useState<Record<string, string>>({});
  const [editingStocks, setEditingStocks] = useState<Record<string, number>>({});
  const [editingCosts, setEditingCosts] = useState<Record<string, number>>({});
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});

  // Tạo sản phẩm mới / Nhập thẳng vào kho
  const [newProdName, setNewProdName] = useState("");
  const [newProdCatId, setNewProdCatId] = useState("");
  const [newProdUnit, setNewProdUnit] = useState("Cái");
  const [newProdQty, setNewProdQty] = useState<number>(1);
  const [newProdWarehouse, setNewProdWarehouse] = useState<WarehouseFloor>("FLOOR_1");
  const [newProdCost, setNewProdCost] = useState<number>(0);
  const [newProdPrice, setNewProdPrice] = useState<number>(0);

  // Lập phiếu điều chỉnh kho
  const [adjProductId, setAdjProductId] = useState("");
  const [adjWarehouse, setAdjWarehouse] = useState<WarehouseFloor>("FLOOR_1");
  const [adjQuantityChange, setAdjQuantityChange] = useState<number>(0);
  const [adjReason, setAdjReason] = useState("");

  // Lập phiếu xuất kho chuyển tầng (Kho Tầng 1 <-> Kho Tầng 2)
  const [transfersList, setTransfersList] = useState<StockMovement[]>([]);
  const [transferProductId, setTransferProductId] = useState("");
  const [transferDirection, setTransferDirection] = useState<"F1_TO_F2" | "F2_TO_F1">("F1_TO_F2");
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferNote, setTransferNote] = useState("");

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

      const nameMap: Record<string, string> = {};
      const catMap: Record<string, string> = {};
      const unitMap: Record<string, string> = {};
      const stockMap: Record<string, number> = {};
      const costMap: Record<string, number> = {};
      const priceMap: Record<string, number> = {};
      pList.forEach((p) => {
        nameMap[p._id] = p.name || "";
        catMap[p._id] =
          typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
        unitMap[p._id] = p.unit || "Cái";
        stockMap[p._id] = Number(p.stock || 0);
        costMap[p._id] = Number(p.costPrice || 0);
        priceMap[p._id] = Number(p.sellingPrice || 0);
      });
      setEditingNames(nameMap);
      setEditingCats(catMap);
      setEditingUnits(unitMap);
      setEditingStocks(stockMap);
      setEditingCosts(costMap);
      setEditingPrices(priceMap);

      if (cList.length > 0 && !newProdCatId) setNewProdCatId(cList[0]._id);
      if (pList.length > 0 && !adjProductId) setAdjProductId(pList[0]._id);
      if (pList.length > 0 && !transferProductId) setTransferProductId(pList[0]._id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [categoryId, search, newProdCatId, adjProductId, transferProductId]);

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

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<StockMovement[]>("/inventory/transfers");
      setTransfersList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTransfersList([]);
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
    if (subTab === "TRANSFER") loadTransfers();
  }, [subTab, loadReport, loadMovements, loadImports, loadTransfers]);

  const handleUpdateProductPrices = async (prod: Product) => {
    setStatusMsg(null);
    const newName = String(editingNames[prod._id] ?? prod.name ?? "").trim();
    const newCatId = String(
      editingCats[prod._id] ??
        (typeof prod.categoryId === "object" ? prod.categoryId?._id : prod.categoryId) ??
        ""
    );
    const newUnit = String(editingUnits[prod._id] ?? prod.unit ?? "Cái").trim() || "Cái";
    const newStock = Math.max(
      0,
      Math.round(Number(editingStocks[prod._id] ?? prod.stock ?? 0))
    );
    const newCost = Number(editingCosts[prod._id] ?? prod.costPrice ?? 0);
    const newPrice = Number(editingPrices[prod._id] ?? prod.sellingPrice ?? 0);
    if (!newName) {
      setStatusMsg({ type: "error", text: "Tên sản phẩm không được để trống." });
      return;
    }
    if (newStock < 0 || newCost < 0 || newPrice < 0) {
      setStatusMsg({
        type: "error",
        text: "Số lượng, giá gốc và giá bán không được âm.",
      });
      return;
    }
    try {
      await apiRequest(`/products/${prod._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: newName,
          ...(newCatId ? { categoryId: newCatId } : {}),
          unit: newUnit,
          stock: newStock,
          allowDirectStock: true,
          costPrice: newCost,
          sellingPrice: newPrice,
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã cập nhật "${newName}": SL tồn ${newStock} ${newUnit} · Giá gốc ${formatVND(
          newCost
        )} · Giá bán ${formatVND(newPrice)}!`,
      });
      loadProductsAndCats();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Lỗi khi cập nhật sản phẩm.",
      });
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn XÓA sản phẩm "${prod.name}" (Mã: ${prod.code}) khỏi kho không?`
      )
    ) {
      return;
    }
    setStatusMsg(null);
    try {
      await apiRequest(`/products/${prod._id}`, { method: "DELETE" });
      setStatusMsg({
        type: "success",
        text: `Đã xóa sản phẩm "${prod.name}" (${prod.code}) khỏi hệ thống!`,
      });
      loadProductsAndCats();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể xóa sản phẩm.",
      });
    }
  };

  const handleDeleteImportReceipt = async (imp: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const code = imp.code || imp.receiptCode || imp._id;
    const isCompleted = imp.status === "COMPLETED";
    const msg = isCompleted
      ? `Phiếu nhập "${code}" đã HOÀN THÀNH. Nếu xóa, hệ thống sẽ hoàn tác số lượng đã cộng vào kho. Bạn có chắc chắn muốn xóa không?`
      : `Bạn có chắc chắn muốn xóa phiếu nhập "${code}" không?`;
    if (!window.confirm(msg)) return;
    setStatusMsg(null);
    try {
      await apiRequest(`/imports/${imp._id}`, { method: "DELETE" });
      setStatusMsg({
        type: "success",
        text: `Đã xóa phiếu nhập "${code}" thành công!`,
      });
      if (expandedImportId === imp._id) setExpandedImportId(null);
      loadImports();
      loadProductsAndCats();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể xóa phiếu nhập.",
      });
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!newProdName.trim()) return;
    const qty = Math.max(0, Math.round(Number(newProdQty || 0)));
    const floorText = newProdWarehouse === "FLOOR_2" ? "Kho Tầng 2" : "Kho Tầng 1";
    try {
      const res = await apiRequest<any>("/products", {
        method: "POST",
        body: JSON.stringify({
          name: newProdName.trim(),
          categoryId: newProdCatId,
          unit: newProdUnit,
          quantity: qty,
          targetWarehouse: newProdWarehouse,
          costPrice: Math.max(0, Number(newProdCost || 0)),
          sellingPrice: Math.max(0, Number(newProdPrice || 0)),
          upsertIfExists: true,
        }),
      });
      const code = generateProductCode(newProdName);
      const isUpserted = Boolean(res?.meta?.upserted);
      setStatusMsg({
        type: "success",
        text: isUpserted
          ? `Mã "${code}" đã có — Đã cộng thêm +${qty} ${newProdUnit} vào ${floorText} (Tổng tồn: ${res?.data?.stock ?? qty})!`
          : `Đã nhập thẳng sản phẩm "${code}" vào ${floorText} với số lượng ${qty} ${newProdUnit}!`,
      });
      setNewProdName("");
      setNewProdQty(1);
      setNewProdCost(0);
      setNewProdPrice(0);
      loadProductsAndCats();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể nhập sản phẩm vào kho.",
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
          warehouse: adjWarehouse,
          quantityChange: Number(adjQuantityChange),
          reason: adjReason.trim(),
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã lập Phiếu Điều Chỉnh Kho (${adjWarehouse === "FLOOR_2" ? "Kho Tầng 2" : "Kho Tầng 1"}) thành công!`,
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

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const qty = Math.round(Number(transferQty) || 0);
    if (!transferProductId || qty <= 0) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng chọn sản phẩm và nhập số lượng cần dời lớn hơn 0.",
      });
      return;
    }
    const fromWarehouse: WarehouseFloor =
      transferDirection === "F1_TO_F2" ? "FLOOR_1" : "FLOOR_2";
    const toWarehouse: WarehouseFloor =
      transferDirection === "F1_TO_F2" ? "FLOOR_2" : "FLOOR_1";

    try {
      const res = await apiRequest<any>("/inventory/transfers", {
        method: "POST",
        body: JSON.stringify({
          productId: transferProductId,
          fromWarehouse,
          toWarehouse,
          quantity: qty,
          note: transferNote.trim(),
        }),
      });
      const code = res?.data?.movement?.referenceCode || "PXK";
      const fromText = fromWarehouse === "FLOOR_1" ? "Kho Tầng 1" : "Kho Tầng 2";
      const toText = toWarehouse === "FLOOR_1" ? "Kho Tầng 1" : "Kho Tầng 2";
      setStatusMsg({
        type: "success",
        text: `Đã tạo Phiếu Xuất Kho ${code}: Dời ${qty} sản phẩm từ ${fromText} sang ${toText} & ghi nhận vào Hoạt động nhân viên!`,
      });
      setTransferQty(1);
      setTransferNote("");
      loadProductsAndCats();
      loadTransfers();
      loadMovements();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể tạo phiếu xuất kho chuyển tầng.",
      });
    }
  };

  // Thống kê tổng hợp trên danh sách sản phẩm đang hiển thị
  const totalStockQty = products.reduce((s, p) => s + (Number(p.stock) || 0), 0);
  const totalCostInventoryValue = products.reduce(
    (s, p) => s + (Number(p.stock) || 0) * (Number(editingCosts[p._id] ?? p.costPrice) || 0),
    0
  );
  const totalSellInventoryValue = products.reduce(
    (s, p) => s + (Number(p.stock) || 0) * (Number(editingPrices[p._id] ?? p.sellingPrice) || 0),
    0
  );
  const totalExpectedMargin = totalSellInventoryValue - totalCostInventoryValue;

  // Map tra cứu nhanh sản phẩm theo mã/id cho Phiếu nhập
  const productByCode = new Map(products.map((p) => [p.code, p]));

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
          1. Sản phẩm, Số lượng, Giá gốc & Giá bán
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
          2. Báo cáo Tồn kho theo kỳ (SL, Giá gốc, Giá bán)
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
          3. Sổ kho (Số lượng, Giá gốc, Giá bán)
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

        <button
          type="button"
          onClick={() => setSubTab("TRANSFER")}
          className={`px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-2 transition ${
            subTab === "TRANSFER"
              ? "bg-indigo-700 text-white shadow"
              : "text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          6. Xuất Kho Chuyển Tầng (Kho 1 ↔ Kho 2)
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

      {/* SUB-TAB 1: SẢN PHẨM, SỐ LƯỢNG, GIÁ GỐC & GIÁ BÁN LẺ */}
      {subTab === "PRODUCTS" && (
        <div className="space-y-6">
          {/* 4 Thẻ KPI Tổng hợp Số lượng, Giá gốc, Giá bán */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-slate-500">
                Tổng số lượng tồn kho ({products.length} mã SP)
              </div>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">
                {totalStockQty.toLocaleString("vi-VN")}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Đơn vị sản phẩm đang có trong kho
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-slate-500">
                Tổng giá trị kho (Theo Giá gốc)
              </div>
              <div className="text-2xl font-extrabold font-mono text-amber-700 mt-1">
                {formatVND(totalCostInventoryValue)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Chỉ hiển thị cho Quản lý/Admin (ẩn với Saler)
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-slate-500">
                Tổng giá trị kho (Theo Giá bán)
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-700 mt-1">
                {formatVND(totalSellInventoryValue)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Doanh thu dự kiến nếu bán hết tồn kho
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-emerald-400">
                Lãi gộp dự kiến trên tồn kho
              </div>
              <div
                className={`text-2xl font-extrabold font-mono mt-1 ${
                  totalExpectedMargin >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatVND(totalExpectedMargin)}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                = Tổng giá bán − Tổng giá gốc
              </div>
            </div>
          </div>

          {/* Form nhập thẳng sản phẩm vào kho (Số lượng + Giá gốc + Giá bán) */}
          <form
            onSubmit={handleCreateProduct}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Nhập thẳng Sản phẩm vào kho (Tự sinh Mã từ `(...)` · Tự động ghi Sổ kho)
              </h3>
              {newProdName.trim() && (
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Mã tự sinh: {generateProductCode(newProdName)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-3">
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
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Category
                </label>
                <select
                  value={newProdCatId}
                  onChange={(e) => setNewProdCatId(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-indigo-700 mb-1">
                  Nhập vào Kho *
                </label>
                <select
                  value={newProdWarehouse}
                  onChange={(e) =>
                    setNewProdWarehouse(
                      e.target.value === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1"
                    )
                  }
                  className="w-full px-2 py-2 rounded-lg border border-indigo-400 bg-indigo-50/40 text-xs font-bold text-slate-900"
                >
                  <option value="FLOOR_1">🏢 Kho Tầng 1</option>
                  <option value="FLOOR_2">🏬 Kho Tầng 2</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  ĐVT
                </label>
                <input
                  type="text"
                  value={newProdUnit}
                  onChange={(e) => setNewProdUnit(e.target.value)}
                  placeholder="Cái"
                  className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs text-center"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-emerald-700 mb-1">
                  Số lượng *
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={newProdQty}
                  onChange={(e) =>
                    setNewProdQty(Math.max(0, Math.round(Number(e.target.value) || 0)))
                  }
                  className="w-full px-2 py-2 rounded-lg border border-emerald-400 bg-emerald-50/50 text-xs font-mono font-extrabold text-emerald-900 text-right"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Giá gốc
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newProdCost > 0 ? formatNumberDots(newProdCost) : ""}
                    onChange={(e) => setNewProdCost(parseNumberDots(e.target.value))}
                    placeholder="0"
                    className="w-full pl-2 pr-8 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold text-right"
                  />
                  <span className="absolute right-1.5 top-2 text-[9px] font-mono font-bold text-slate-400 pointer-events-none">
                    VND
                  </span>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Giá bán (VND)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newProdPrice > 0 ? formatNumberDots(newProdPrice) : ""}
                    onChange={(e) => setNewProdPrice(parseNumberDots(e.target.value))}
                    placeholder="0"
                    className="w-full pl-2.5 pr-10 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold text-right"
                  />
                  <span className="absolute right-2.5 top-2 text-[10px] font-mono font-bold text-slate-400 pointer-events-none">
                    VND
                  </span>
                </div>
              </div>
              <div className="md:col-span-1">
                <button
                  type="submit"
                  className="w-full py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs whitespace-nowrap"
                >
                  + Nhập kho
                </button>
              </div>
            </div>
          </form>

          {/* Bảng danh sách sản phẩm: Số lượng, Giá gốc & Giá bán */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Danh mục Sản phẩm — Số lượng, Giá gốc & Giá bán lẻ (BR-04)
                </h3>
                <p className="text-xs text-slate-500">
                  Quản lý/Admin xem và cập nhật cả <strong>Giá gốc</strong> lẫn <strong>Giá bán lẻ</strong>. Bên màn hình Saler (nhân viên bán hàng) chỉ nhìn thấy <strong>Số lượng</strong> và <strong>Giá bán</strong>, hoàn toàn không thấy Giá gốc.
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
                    <th className="py-3 px-3 min-w-[260px]">Tên sản phẩm</th>
                    <th className="py-3 px-3 min-w-[140px]">Category</th>
                    <th className="py-3 px-2.5 text-center w-20">ĐVT</th>
                    <th className="py-3 px-3 text-right w-36 whitespace-nowrap">Số lượng tồn</th>
                    <th className="py-3 px-3 text-right w-44 whitespace-nowrap">Giá gốc (VND)</th>
                    <th className="py-3 px-3 text-right w-44 whitespace-nowrap">Giá bán lẻ (VND)</th>
                    <th className="py-3 px-3 text-right w-40 whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {products.map((p) => {
                    const nameVal = editingNames[p._id] ?? p.name ?? "";
                    const catVal =
                      editingCats[p._id] ??
                      (typeof p.categoryId === "object"
                        ? p.categoryId?._id || ""
                        : String(p.categoryId || ""));
                    const unitVal = editingUnits[p._id] ?? p.unit ?? "Cái";
                    const qty = Number(editingStocks[p._id] ?? p.stock ?? 0);
                    const origQty = Number(p.stock) || 0;
                    const costVal = Number(editingCosts[p._id] ?? p.costPrice ?? 0);
                    const sellVal = Number(editingPrices[p._id] ?? p.sellingPrice ?? 0);
                    const margin = sellVal - costVal;
                    return (
                      <tr key={p._id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-mono font-bold text-slate-800 align-top">
                          {p.code}
                        </td>
                        <td className="py-3 px-3 align-top">
                          <textarea
                            rows={Math.max(2, Math.ceil((nameVal.length || 0) / 36))}
                            value={nameVal}
                            onChange={(e) =>
                              setEditingNames((prev) => ({
                                ...prev,
                                [p._id]: e.target.value,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-semibold text-slate-900 whitespace-pre-wrap break-words leading-snug resize-y"
                          />
                        </td>
                        <td className="py-3 px-3 align-top">
                          <select
                            value={catVal}
                            onChange={(e) =>
                              setEditingCats((prev) => ({
                                ...prev,
                                [p._id]: e.target.value,
                              }))
                            }
                            className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-700"
                          >
                            {categories.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-2.5 text-center align-top">
                          <input
                            type="text"
                            value={unitVal}
                            onChange={(e) =>
                              setEditingUnits((prev) => ({
                                ...prev,
                                [p._id]: e.target.value,
                              }))
                            }
                            className="w-16 px-2 py-1.5 rounded border border-slate-300 text-center"
                          />
                        </td>
                        <td className="py-3 px-3 text-right align-top">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={qty}
                            onChange={(e) =>
                              setEditingStocks((prev) => ({
                                ...prev,
                                [p._id]: Math.max(0, Math.round(Number(e.target.value) || 0)),
                              }))
                            }
                            className={`w-28 px-2.5 py-1.5 rounded border text-right font-mono font-extrabold ${
                              qty !== origQty
                                ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                                : "border-slate-300 bg-white text-emerald-700"
                            }`}
                          />
                          <div className="mt-1 text-[10px] text-slate-600 font-mono">
                            🏢 T1: <b>{p.stockFloor1 ?? p.stock}</b> · 🏬 T2: <b>{p.stockFloor2 ?? 0}</b>
                          </div>
                          {qty !== origQty && (
                            <div className="mt-0.5 text-[10px] font-mono font-bold text-emerald-700">
                              Hiện tại: {origQty} ({qty > origQty ? `+${qty - origQty}` : qty - origQty})
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right align-top">
                          <div className="relative inline-block w-40">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={costVal > 0 ? formatNumberDots(costVal) : ""}
                              placeholder="0"
                              onChange={(e) =>
                                setEditingCosts((prev) => ({
                                  ...prev,
                                  [p._id]: parseNumberDots(e.target.value),
                                }))
                              }
                              className={`w-full pl-2.5 pr-10 py-1.5 rounded border text-right font-mono font-bold ${
                                costVal === 0
                                  ? "border-orange-300 bg-orange-50 text-orange-900"
                                  : "border-slate-300 bg-white text-slate-800"
                              }`}
                            />
                            <span className="absolute right-2.5 top-2 text-[10px] font-mono font-bold text-slate-400 pointer-events-none">
                              VND
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500 font-mono">
                            Tổng vốn: {formatVND(qty * costVal)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right align-top">
                          <div className="relative inline-block w-40">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={sellVal > 0 ? formatNumberDots(sellVal) : ""}
                              placeholder="0"
                              onChange={(e) =>
                                setEditingPrices((prev) => ({
                                  ...prev,
                                  [p._id]: parseNumberDots(e.target.value),
                                }))
                              }
                              className={`w-full pl-2.5 pr-10 py-1.5 rounded border text-right font-mono font-bold ${
                                sellVal === 0
                                  ? "border-amber-400 bg-amber-50 text-amber-900"
                                  : "border-slate-300 bg-white text-slate-900"
                              }`}
                            />
                            <span className="absolute right-2.5 top-2 text-[10px] font-mono font-bold text-slate-400 pointer-events-none">
                              VND
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500 font-mono">
                            Tổng bán: {formatVND(qty * sellVal)}
                          </div>
                          {sellVal > 0 && costVal > 0 && (
                            <div
                              className={`mt-0.5 text-[10px] font-bold ${
                                margin < 0 ? "text-red-600" : "text-emerald-700"
                              }`}
                            >
                              {margin < 0 ? "Lỗ" : "Lãi"}: {formatVND(Math.abs(margin))}/SP (
                              {Math.round((margin / costVal) * 100)}%)
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right align-top">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateProductPrices(p)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1"
                              title="Lưu thay đổi sản phẩm"
                            >
                              <Save className="w-3.5 h-3.5" /> Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTransferProductId(p._id);
                                setSubTab("TRANSFER");
                              }}
                              className="p-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 inline-flex items-center justify-center"
                              title="Dời sản phẩm giữa Kho Tầng 1 và Kho Tầng 2 (Lập phiếu xuất kho)"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p)}
                              className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 inline-flex items-center justify-center"
                              title="Xóa sản phẩm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {products.length > 0 && (
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-right uppercase">
                        Tổng cộng ({products.length} sản phẩm):
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-700">
                        {totalStockQty}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-800">
                        {formatVND(totalCostInventoryValue)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-800">
                        {formatVND(totalSellInventoryValue)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BÁO CÁO TỒN KHO THEO KỲ (SỐ LƯỢNG + GIÁ GỐC + GIÁ BÁN) */}
      {subTab === "REPORT" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Báo cáo Kế toán Tồn kho theo kỳ — Số lượng, Giá gốc & Giá bán (BR-06)
              </h3>
              <p className="text-xs text-slate-500">
                Công thức chuẩn:{" "}
                <strong className="text-slate-800">
                  Số lượng Tồn cuối kỳ = Tồn đầu kỳ + Nhập trong kỳ − Bán trong kỳ ± Điều chỉnh
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
                  <th className="py-3 px-2.5 text-center">ĐVT</th>
                  <th className="py-3 px-2.5 text-right">Đầu Kỳ</th>
                  <th className="py-3 px-2.5 text-right text-emerald-300">+ Nhập</th>
                  <th className="py-3 px-2.5 text-right text-amber-300">− Bán</th>
                  <th className="py-3 px-2.5 text-right text-blue-300">± Đ.Chỉnh</th>
                  <th className="py-3 px-3 text-right font-extrabold bg-slate-800">
                    = SL Tồn Cuối
                  </th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá gốc (VND)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá bán (VND)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap bg-slate-800 text-amber-300">
                    Tổng vốn tồn
                  </th>
                  <th className="py-3 px-3 text-right whitespace-nowrap bg-slate-800 text-emerald-300">
                    Tổng giá bán tồn
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reportRows.map((r, i) => {
                  const cost = Number(r.costPrice) || 0;
                  const sell = Number(r.sellingPrice) || 0;
                  const closing = Number(r.closingStock) || 0;
                  return (
                    <tr key={r.productId || i} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold">{r.productCode}</td>
                      <td className="py-3 px-3 font-semibold">{r.productName}</td>
                      <td className="py-3 px-2.5 text-center">{r.unit}</td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold">
                        {r.openingStock}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-emerald-700">
                        +{r.importedQty}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-amber-700">
                        -{r.soldQty}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-blue-700">
                        {r.adjustedAndReturnedQty > 0
                          ? `+${r.adjustedAndReturnedQty}`
                          : r.adjustedAndReturnedQty}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 bg-slate-50">
                        {closing}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        {cost > 0 ? formatVND(cost) : <span className="text-slate-400">0 VND</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {sell > 0 ? formatVND(sell) : <span className="text-amber-700">0 VND</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-amber-800 bg-amber-50/40 whitespace-nowrap">
                        {formatVND(closing * cost)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-800 bg-emerald-50/40 whitespace-nowrap">
                        {formatVND(closing * sell)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {reportRows.length > 0 && (
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-right uppercase">
                      Tổng cộng ({reportRows.length} SP):
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono">
                      {reportRows.reduce((s, r) => s + (Number(r.openingStock) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-emerald-700">
                      +{reportRows.reduce((s, r) => s + (Number(r.importedQty) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-amber-700">
                      -{reportRows.reduce((s, r) => s + (Number(r.soldQty) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-blue-700">
                      {reportRows.reduce((s, r) => s + (Number(r.adjustedAndReturnedQty) || 0), 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {reportRows.reduce((s, r) => s + (Number(r.closingStock) || 0), 0)}
                    </td>
                    <td colSpan={2}></td>
                    <td className="py-3 px-3 text-right font-mono text-amber-800 whitespace-nowrap">
                      {formatVND(
                        reportRows.reduce(
                          (s, r) => s + (Number(r.closingStock) || 0) * (Number(r.costPrice) || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-800 whitespace-nowrap">
                      {formatVND(
                        reportRows.reduce(
                          (s, r) => s + (Number(r.closingStock) || 0) * (Number(r.sellingPrice) || 0),
                          0
                        )
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SỔ KHO (STOCK MOVEMENTS — SỐ LƯỢNG, GIÁ GỐC, GIÁ BÁN) */}
      {subTab === "MOVEMENTS" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Sổ Kho Kế Toán — Số lượng, Giá gốc & Giá bán (Stock Movements — BR-07)
              </h3>
              <p className="text-xs text-slate-500">
                Lưu vết toàn bộ lịch sử biến động tồn kho kèm Số lượng, Giá gốc, Giá bán, mã chứng từ tham chiếu và nhân viên thực hiện.
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
                <option value="TRANSFER">TRANSFER (Xuất kho chuyển tầng PXK)</option>
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
                  <th className="py-3 px-3 text-right whitespace-nowrap">SL Biến động</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">SL Tồn sau GD</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá gốc (VND)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá bán (VND)</th>
                  <th className="py-3 px-3">Chứng từ</th>
                  <th className="py-3 px-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {movements.map((m) => {
                  const fallbackProd = productByCode.get(m.productCode);
                  const cost = Number(m.costPrice ?? fallbackProd?.costPrice ?? 0);
                  const sell = Number(m.sellingPrice ?? fallbackProd?.sellingPrice ?? 0);
                  return (
                    <tr key={m._id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
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
                      <td className="py-2.5 px-3 text-right font-mono text-amber-800 whitespace-nowrap">
                        {cost > 0 ? formatVND(cost) : <span className="text-slate-400">0 VND</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                        {sell > 0 ? formatVND(sell) : <span className="text-slate-400">0 VND</span>}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-blue-700 whitespace-nowrap">
                        {m.referenceCode || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{m.note || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: DANH SÁCH PHIẾU NHẬP KHO (KÈM SỐ LƯỢNG, GIÁ GỐC, GIÁ BÁN) */}
      {subTab === "IMPORTS" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Danh sách Phiếu Nhập Kho — Số lượng, Giá gốc & Giá bán (BR-09, BR-10)
              </h3>
              <p className="text-xs text-slate-500">
                Bấm vào một dòng phiếu nhập để xem chi tiết từng mặt hàng (Số lượng, Giá gốc, Giá bán).
              </p>
            </div>
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
                  <th className="py-3 px-3 text-right">Số dòng</th>
                  <th className="py-3 px-3 text-right">Tổng SL thực nhận</th>
                  <th className="py-3 px-3 text-right">Tổng giá gốc</th>
                  <th className="py-3 px-3 text-right">Tổng theo giá bán</th>
                  <th className="py-3 px-3">Người lập</th>
                  <th className="py-3 px-3">Người kiểm (chiếc)</th>
                  <th className="py-3 px-3">Người hoàn thành</th>
                  <th className="py-3 px-3">Ngày tạo</th>
                  <th className="py-3 px-2 w-20 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {importsList.map((imp) => {
                  const items: any[] = imp.items || [];
                  const totalQty = items.reduce(
                    (s, it) => s + (Number(it.actualQuantity ?? it.expectedQuantity) || 0),
                    0
                  );
                  const totalCost = items.reduce(
                    (s, it) =>
                      s +
                      (Number(it.costPrice) || 0) *
                        (Number(it.actualQuantity ?? it.expectedQuantity) || 0),
                    0
                  );
                  const totalSell = items.reduce((s, it) => {
                    const p = productByCode.get(it.productCode);
                    const sellPrice = Number(p?.sellingPrice || 0);
                    return (
                      s + sellPrice * (Number(it.actualQuantity ?? it.expectedQuantity) || 0)
                    );
                  }, 0);
                  const isExpanded = expandedImportId === imp._id;

                  return (
                    <React.Fragment key={imp._id}>
                      <tr
                        onClick={() =>
                          setExpandedImportId(isExpanded ? null : imp._id)
                        }
                        className="hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
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
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {items.length}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900">
                          {totalQty}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-800 whitespace-nowrap">
                          {formatVND(totalCost)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                          {formatVND(totalSell)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {imp.createdByName || "-"}
                        </td>
                        <td className="py-3 px-3">
                          {(() => {
                            const byName = new Map<string, number>();
                            items.forEach((it: any) =>
                              (it.scanCounts || []).forEach((s: any) =>
                                byName.set(
                                  s.name,
                                  (byName.get(s.name) || 0) + (Number(s.quantity) || 0)
                                )
                              )
                            );
                            return byName.size === 0
                              ? "-"
                              : Array.from(byName.entries())
                                  .map(([n, q]) => `${n} (${q})`)
                                  .join(", ");
                          })()}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {imp.completedByName || "-"}
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {formatDateTime(imp.createdAt)}
                        </td>
                        <td className="py-3 px-2 text-center text-slate-500">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteImportReceipt(imp, e)}
                              className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600"
                              title="Xóa phiếu nhập"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 inline" />
                            ) : (
                              <ChevronDown className="w-4 h-4 inline" />
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={11} className="p-3">
                            <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                              <table className="w-full text-[11px] text-left">
                                <thead className="bg-slate-800 text-white uppercase">
                                  <tr>
                                    <th className="py-2 px-2.5 text-center">STT</th>
                                    <th className="py-2 px-2.5">Mã hàng</th>
                                    <th className="py-2 px-2.5">Tên sản phẩm</th>
                                    <th className="py-2 px-2.5 text-center">ĐVT</th>
                                    <th className="py-2 px-2.5 text-right">SL Dự kiến</th>
                                    <th className="py-2 px-2.5 text-right">SL Thực nhận</th>
                                    <th className="py-2 px-2.5 text-right">Giá gốc (VND)</th>
                                    <th className="py-2 px-2.5 text-right">Giá bán hiện tại</th>
                                    <th className="py-2 px-2.5 text-right">Thành tiền (Giá gốc)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {items.map((it: any, idx: number) => {
                                    const prod = productByCode.get(it.productCode);
                                    const qty = Number(it.actualQuantity ?? it.expectedQuantity) || 0;
                                    const cost = Number(it.costPrice || prod?.costPrice || 0);
                                    const sell = Number(prod?.sellingPrice || 0);
                                    return (
                                      <tr key={idx}>
                                        <td className="py-1.5 px-2.5 text-center font-mono">
                                          {it.stt || idx + 1}
                                        </td>
                                        <td className="py-1.5 px-2.5 font-mono font-bold">
                                          {it.productCode}
                                        </td>
                                        <td className="py-1.5 px-2.5 font-semibold">
                                          {it.productName}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">{it.unit}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono">
                                          {it.expectedQuantity}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-extrabold text-emerald-700">
                                          {qty}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono text-amber-800">
                                          {formatVND(cost)}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-800">
                                          {sell > 0 ? formatVND(sell) : "Chưa đặt (0 VND)"}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold">
                                          {formatVND(qty * cost)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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
                    {p.name} ({p.code}) — Tổng tồn: {p.stock} {p.unit} (T1: {p.stockFloor1 ?? p.stock} · T2: {p.stockFloor2 ?? 0})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Chọn Kho điều chỉnh *
              </label>
              <select
                value={adjWarehouse}
                onChange={(e) =>
                  setAdjWarehouse(e.target.value === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1")
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
              >
                <option value="FLOOR_1">🏢 Kho Tầng 1</option>
                <option value="FLOOR_2">🏬 Kho Tầng 2</option>
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

      {/* SUB-TAB 6: XUẤT KHO CHUYỂN TẦNG (KHO TẦNG 1 <-> KHO TẦNG 2) */}
      {subTab === "TRANSFER" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
                  Tạo Phiếu Xuất Kho Chuyển Tầng (Kho Tầng 1 ↔ Kho Tầng 2)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Admin dời sản phẩm từ <strong>Kho Tầng 1</strong> xuống <strong>Kho Tầng 2</strong> hoặc ngược lại. Hệ thống tự động tạo <strong>Phiếu Xuất Kho (PXK-...)</strong>, cập nhật tồn từng tầng và ghi nhận vào mục <strong>Hoạt động nhân viên</strong>.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleCreateTransfer}
              className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
            >
              <div className="md:col-span-5">
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Chọn Sản phẩm cần dời kho *
                </label>
                <select
                  value={transferProductId}
                  onChange={(e) => setTransferProductId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
                >
                  {products.map((p) => {
                    const f1 = p.stockFloor1 ?? p.stock;
                    const f2 = p.stockFloor2 ?? 0;
                    return (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.code}) — 🏢 Tầng 1: {f1} {p.unit} | 🏬 Tầng 2: {f2} {p.unit} (Tổng: {p.stock})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold uppercase text-indigo-700 mb-1">
                  Hướng dời kho (Kho xuất → Kho nhận) *
                </label>
                <select
                  value={transferDirection}
                  onChange={(e) =>
                    setTransferDirection(
                      e.target.value === "F2_TO_F1" ? "F2_TO_F1" : "F1_TO_F2"
                    )
                  }
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-indigo-500 bg-indigo-50/40 text-xs font-extrabold text-indigo-950"
                >
                  <option value="F1_TO_F2">🏢 Kho Tầng 1 → 🏬 Kho Tầng 2</option>
                  <option value="F2_TO_F1">🏬 Kho Tầng 2 → 🏢 Kho Tầng 1</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Số lượng xuất dời *
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={transferQty}
                  onChange={(e) =>
                    setTransferQty(Math.max(1, Math.round(Number(e.target.value) || 1)))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-extrabold text-right"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow flex items-center justify-center gap-1.5"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Tạo Phiếu Xuất Kho
                </button>
              </div>

              <div className="md:col-span-12">
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Ghi chú Phiếu Xuất Kho (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="VD: Dời hàng xuống Kho Tầng 2 để trưng bày / bổ sung quầy bán..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">
              Lịch sử Phiếu Xuất Kho Chuyển Tầng (PXK — Đã ghi nhận vào Hoạt động nhân viên)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase">
                  <tr>
                    <th className="py-3 px-3">Mã Phiếu Xuất</th>
                    <th className="py-3 px-3">Thời gian</th>
                    <th className="py-3 px-3">Sản phẩm</th>
                    <th className="py-3 px-3">Từ Kho</th>
                    <th className="py-3 px-3">Sang Kho</th>
                    <th className="py-3 px-3 text-right">Số lượng xuất</th>
                    <th className="py-3 px-3">Người thực hiện</th>
                    <th className="py-3 px-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {transfersList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Chưa có phiếu xuất kho chuyển tầng nào.
                      </td>
                    </tr>
                  ) : (
                    transfersList.map((t) => (
                      <tr key={t._id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                          {t.referenceCode}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {formatDateTime(t.createdAt)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{t.productName}</div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {t.productCode}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-700">
                          {t.fromWarehouse === "FLOOR_2" ? "🏬 Kho Tầng 2" : "🏢 Kho Tầng 1"}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-indigo-700">
                          {t.toWarehouse === "FLOOR_2" ? "🏬 Kho Tầng 2" : "🏢 Kho Tầng 1"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-indigo-700">
                          {t.quantityChange}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {t.performedByName || "Quản trị viên"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{t.note || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
