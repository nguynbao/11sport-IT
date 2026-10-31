"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  useDebounce,
  filterAndRankBySearch,
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
  ArrowLeftRight,
  Eye,
  History,
  UserCheck,
  X,
  RotateCcw,
} from "lucide-react";

type SubTab = "PRODUCTS" | "REPORT" | "MOVEMENTS" | "IMPORTS" | "ADJUSTMENT" | "TRANSFER";
type ActiveWarehouseTab = "FLOOR_1" | "FLOOR_2" | "ALL";

function CmsRoleBadge({ role, compact = false }: { role?: string; compact?: boolean }) {
  const r = String(role || "").toUpperCase();
  if (r === "ADMIN") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap">
        {compact ? "ADMIN" : "ADMIN (Quản lý)"}
      </span>
    );
  }
  if (r === "WAREHOUSE") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-100 text-teal-800 border border-teal-200 whitespace-nowrap">
        {compact ? "WAREHOUSE" : "WAREHOUSE (Thủ kho)"}
      </span>
    );
  }
  if (r === "SALES") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap">
        {compact ? "SALES" : "SALES (Bán hàng)"}
      </span>
    );
  }
  return null;
}

export default function InventoryModule() {
  const [subTab, setSubTab] = useState<SubTab>("PRODUCTS");
  const [activeWarehouse, setActiveWarehouse] = useState<ActiveWarehouseTab>("FLOOR_1");
  const [showZeroFloorItems, setShowZeroFloorItems] = useState(false);

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

  // Phân trang (Pagination) cho Quản lý kho
  const [prodPage, setProdPage] = useState<number>(1);
  const [prodPageSize, setProdPageSize] = useState<number>(15);
  const [reportPage, setReportPage] = useState<number>(1);
  const [reportPageSize, setReportPageSize] = useState<number>(20);
  const [movPage, setMovPage] = useState<number>(1);
  const [movPageSize, setMovPageSize] = useState<number>(20);
  const [impPage, setImpPage] = useState<number>(1);
  const [impPageSize, setImpPageSize] = useState<number>(15);

  // Tên, Category, ĐVT, Số lượng từng tầng (Tầng 1, Tầng 2), Giá gốc & Giá bán chỉnh sửa theo productId
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [editingCats, setEditingCats] = useState<Record<string, string>>({});
  const [editingUnits, setEditingUnits] = useState<Record<string, string>>({});
  const [editingFloor1, setEditingFloor1] = useState<Record<string, number>>({});
  const [editingFloor2, setEditingFloor2] = useState<Record<string, number>>({});
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
  const [allCatalogProducts, setAllCatalogProducts] = useState<Product[]>([]);
  const [showNewProdSuggestions, setShowNewProdSuggestions] = useState(false);
  const [newProdHighlightIdx, setNewProdHighlightIdx] = useState<number>(0);

  // Lập phiếu điều chỉnh kho
  const [adjProductId, setAdjProductId] = useState("");
  const [adjWarehouse, setAdjWarehouse] = useState<WarehouseFloor>("FLOOR_1");
  const [adjQuantityChange, setAdjQuantityChange] = useState<number>(0);
  const [adjReason, setAdjReason] = useState("");

  // Lập phiếu xuất kho chuyển tầng (Kho Tầng 1 <-> Kho Tầng 2) — hỗ trợ nhiều sản phẩm / phiếu
  const [transfersList, setTransfersList] = useState<StockMovement[]>([]);
  const [transferDirection, setTransferDirection] = useState<"F1_TO_F2" | "F2_TO_F1">("F1_TO_F2");
  const [transferProductId, setTransferProductId] = useState("");
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferSearch, setTransferSearch] = useState("");
  const [transferItems, setTransferItems] = useState<
    { productId: string; quantity: number }[]
  >([]);
  const [transferNote, setTransferNote] = useState("");
  const [expandedTransferCode, setExpandedTransferCode] = useState<string | null>(null);

  // Trạng thái lưu hàng loạt & xem lại chi tiết nhập hàng
  const [savingBatch, setSavingBatch] = useState(false);
  const [detailModalReceipt, setDetailModalReceipt] = useState<any | null>(null);
  const [showRecentImportsSection, setShowRecentImportsSection] = useState(false);
  const [recentImportRoleFilter, setRecentImportRoleFilter] = useState<"ALL" | "ADMIN" | "WAREHOUSE">("ALL");

  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounce từ khóa tìm kiếm sản phẩm (400ms) và tìm kiếm chuyển tầng (300ms) để tối ưu số lượng request API
  const debouncedSearch = useDebounce(search, 400);
  const debouncedTransferSearch = useDebounce(transferSearch, 300);

  // Tách tải danh mục & phiếu nhập ra riêng để không gọi lại mỗi khi gõ tìm kiếm sản phẩm
  const loadCategoriesAndImports = useCallback(async () => {
    try {
      const [catRes, impRes, movRes, allProdRes] = await Promise.all([
        apiRequest<Category[]>("/categories"),
        apiRequest<any[]>("/imports"),
        apiRequest<StockMovement[]>("/inventory/movements?type=IMPORT"),
        apiRequest<Product[]>("/products"),
      ]);
      const cList = Array.isArray(catRes.data) ? catRes.data : [];
      const iList = Array.isArray(impRes.data) ? impRes.data : [];
      const mList = Array.isArray(movRes.data) ? movRes.data : [];
      const pList = Array.isArray(allProdRes.data) ? allProdRes.data : [];
      setCategories(cList);
      setImportsList(iList);
      setAllCatalogProducts(pList);
      setMovements((prev) => (prev.length > 0 ? prev : mList));
      if (cList.length > 0) {
        setNewProdCatId((prev) => prev || cList[0]._id);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadProductsAndCats = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (categoryId) q.set("categoryId", categoryId);
      if (debouncedSearch.trim()) q.set("search", debouncedSearch.trim());

      const prodRes = await apiRequest<Product[]>(`/products?${q.toString()}`);
      const pList = Array.isArray(prodRes.data) ? prodRes.data : [];
      setProducts(pList);

      const nameMap: Record<string, string> = {};
      const catMap: Record<string, string> = {};
      const unitMap: Record<string, string> = {};
      const f1Map: Record<string, number> = {};
      const f2Map: Record<string, number> = {};
      const costMap: Record<string, number> = {};
      const priceMap: Record<string, number> = {};
      pList.forEach((p) => {
        nameMap[p._id] = p.name || "";
        catMap[p._id] =
          typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
        unitMap[p._id] = p.unit || "Cái";
        f1Map[p._id] = Number(p.stockFloor1 ?? p.stock ?? 0);
        f2Map[p._id] = Number(p.stockFloor2 ?? 0);
        costMap[p._id] = Number(p.costPrice || 0);
        priceMap[p._id] = Number(p.sellingPrice || 0);
      });
      setEditingNames(nameMap);
      setEditingCats(catMap);
      setEditingUnits(unitMap);
      setEditingFloor1(f1Map);
      setEditingFloor2(f2Map);
      setEditingCosts(costMap);
      setEditingPrices(priceMap);

      if (pList.length > 0) {
        setAdjProductId((prev) => prev || pList[0]._id);
        setTransferProductId((prev) => prev || pList[0]._id);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [categoryId, debouncedSearch]);

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
    loadCategoriesAndImports();
  }, [loadCategoriesAndImports]);

  useEffect(() => {
    loadProductsAndCats();
  }, [loadProductsAndCats]);

  useEffect(() => {
    if (subTab === "REPORT") loadReport();
    if (subTab === "MOVEMENTS") loadMovements();
    if (subTab === "IMPORTS") loadImports();
    if (subTab === "TRANSFER") loadTransfers();
  }, [subTab, loadReport, loadMovements, loadImports, loadTransfers]);

  const handleSelectWarehouseTab = (wh: ActiveWarehouseTab) => {
    setActiveWarehouse(wh);
    if (wh === "FLOOR_1" || wh === "FLOOR_2") {
      setNewProdWarehouse(wh);
      setAdjWarehouse(wh);
    }
  };

  // Kiểm tra sản phẩm có thay đổi so với giá trị gốc hay không
  const isProductChanged = useCallback(
    (prod: Product) => {
      const origName = String(prod.name ?? "").trim();
      const origCatId = String(
        typeof prod.categoryId === "object" ? prod.categoryId?._id || "" : prod.categoryId || ""
      );
      const origUnit = String(prod.unit ?? "Cái").trim() || "Cái";
      const origF1 = Math.max(0, Math.round(Number(prod.stockFloor1 ?? prod.stock ?? 0)));
      const origF2 = Math.max(0, Math.round(Number(prod.stockFloor2 ?? 0)));
      const origCost = Number(prod.costPrice ?? 0);
      const origPrice = Number(prod.sellingPrice ?? 0);

      const newName = String(editingNames[prod._id] ?? origName).trim();
      const newCatId = String(editingCats[prod._id] ?? origCatId);
      const newUnit = String(editingUnits[prod._id] ?? origUnit).trim() || "Cái";
      const newF1 = Math.max(0, Math.round(Number(editingFloor1[prod._id] ?? origF1)));
      const newF2 = Math.max(0, Math.round(Number(editingFloor2[prod._id] ?? origF2)));
      const newCost = Number(editingCosts[prod._id] ?? origCost);
      const newPrice = Number(editingPrices[prod._id] ?? origPrice);

      return (
        newName !== origName ||
        newCatId !== origCatId ||
        newUnit !== origUnit ||
        newF1 !== origF1 ||
        newF2 !== origF2 ||
        newCost !== origCost ||
        newPrice !== origPrice
      );
    },
    [editingNames, editingCats, editingUnits, editingFloor1, editingFloor2, editingCosts, editingPrices]
  );

  // Danh sách các sản phẩm đã có chỉnh sửa (số lượng, giá, tên, ĐVT, danh mục)
  const changedProducts = useMemo(() => {
    return products.filter((p) => isProductChanged(p));
  }, [products, isProductChanged]);

  // Hoàn tác toàn bộ chỉnh sửa chưa lưu về dữ liệu gốc
  const handleResetProductEdits = () => {
    const nameMap: Record<string, string> = {};
    const catMap: Record<string, string> = {};
    const unitMap: Record<string, string> = {};
    const f1Map: Record<string, number> = {};
    const f2Map: Record<string, number> = {};
    const costMap: Record<string, number> = {};
    const priceMap: Record<string, number> = {};
    products.forEach((p) => {
      nameMap[p._id] = p.name || "";
      catMap[p._id] =
        typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
      unitMap[p._id] = p.unit || "Cái";
      f1Map[p._id] = Number(p.stockFloor1 ?? p.stock ?? 0);
      f2Map[p._id] = Number(p.stockFloor2 ?? 0);
      costMap[p._id] = Number(p.costPrice || 0);
      priceMap[p._id] = Number(p.sellingPrice || 0);
    });
    setEditingNames(nameMap);
    setEditingCats(catMap);
    setEditingUnits(unitMap);
    setEditingFloor1(f1Map);
    setEditingFloor2(f2Map);
    setEditingCosts(costMap);
    setEditingPrices(priceMap);
    setStatusMsg(null);
  };

  // Gom lại thành 1 nút Lưu duy nhất: Lưu toàn bộ sản phẩm đã có thay đổi
  const handleSaveAllProductChanges = async () => {
    if (changedProducts.length === 0 || savingBatch) return;
    setStatusMsg(null);

    for (const prod of changedProducts) {
      const newName = String(editingNames[prod._id] ?? prod.name ?? "").trim();
      const newF1 = Math.max(
        0,
        Math.round(Number(editingFloor1[prod._id] ?? prod.stockFloor1 ?? prod.stock ?? 0))
      );
      const newF2 = Math.max(
        0,
        Math.round(Number(editingFloor2[prod._id] ?? prod.stockFloor2 ?? 0))
      );
      const newCost = Number(editingCosts[prod._id] ?? prod.costPrice ?? 0);
      const newPrice = Number(editingPrices[prod._id] ?? prod.sellingPrice ?? 0);
      if (!newName) {
        setStatusMsg({
          type: "error",
          text: `Tên sản phẩm (Mã: ${prod.code}) không được để trống.`,
        });
        return;
      }
      if (newF1 < 0 || newF2 < 0 || newCost < 0 || newPrice < 0) {
        setStatusMsg({
          type: "error",
          text: `Số lượng, giá gốc và giá bán của "${newName}" không được âm.`,
        });
        return;
      }
    }

    setSavingBatch(true);
    try {
      for (const prod of changedProducts) {
        const newName = String(editingNames[prod._id] ?? prod.name ?? "").trim();
        const newCatId = String(
          editingCats[prod._id] ??
            (typeof prod.categoryId === "object" ? prod.categoryId?._id : prod.categoryId) ??
            ""
        );
        const newUnit = String(editingUnits[prod._id] ?? prod.unit ?? "Cái").trim() || "Cái";
        const newF1 = Math.max(
          0,
          Math.round(Number(editingFloor1[prod._id] ?? prod.stockFloor1 ?? prod.stock ?? 0))
        );
        const newF2 = Math.max(
          0,
          Math.round(Number(editingFloor2[prod._id] ?? prod.stockFloor2 ?? 0))
        );
        const newStock = newF1 + newF2;
        const newCost = Number(editingCosts[prod._id] ?? prod.costPrice ?? 0);
        const newPrice = Number(editingPrices[prod._id] ?? prod.sellingPrice ?? 0);

        await apiRequest(`/products/${prod._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: newName,
            ...(newCatId ? { categoryId: newCatId } : {}),
            unit: newUnit,
            stockFloor1: newF1,
            stockFloor2: newF2,
            stock: newStock,
            allowDirectStock: true,
            costPrice: newCost,
            sellingPrice: newPrice,
          }),
        });
      }
      setStatusMsg({
        type: "success",
        text: `Đã lưu thành công ${changedProducts.length} mặt hàng có thay đổi (Số lượng tồn Kho Tầng 1 / Tầng 2, Giá gốc, Giá bán)!`,
      });
      await loadProductsAndCats();
      loadCategoriesAndImports();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Lỗi khi lưu thay đổi sản phẩm.",
      });
    } finally {
      setSavingBatch(false);
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

  // Gợi ý các sản phẩm đã có trong kho khi gõ tên hàng ở mục Nhập thẳng sản phẩm vào kho (CMS)
  const newProdSuggestions = useMemo(() => {
    const sourceList = allCatalogProducts.length > 0 ? allCatalogProducts : products;
    const q = newProdName.trim();
    if (!q) return sourceList.slice(0, 8);
    return filterAndRankBySearch(sourceList, q, (p) => [
      p.name,
      p.code,
      p.categoryName,
    ]).slice(0, 8);
  }, [allCatalogProducts, products, newProdName]);

  const handleSelectNewProdSuggestion = (prod: Product) => {
    setNewProdName(prod.name);
    const catId =
      typeof prod.categoryId === "object"
        ? prod.categoryId?._id || ""
        : String(prod.categoryId || "");
    if (catId) setNewProdCatId(catId);
    if (prod.unit) setNewProdUnit(prod.unit);
    if (Number(prod.costPrice) > 0) setNewProdCost(Number(prod.costPrice));
    if (Number(prod.sellingPrice) > 0) setNewProdPrice(Number(prod.sellingPrice));
    setShowNewProdSuggestions(false);
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
      loadCategoriesAndImports();
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

  // Sản phẩm có tồn > 0 tại kho đầu dời (theo hướng dời đang chọn) + Smart Search
  const sourceFloorProducts = useMemo(() => {
    const avail = products.filter((p) => {
      const f1 = Number(p.stockFloor1 ?? p.stock) || 0;
      const f2 = Number(p.stockFloor2) || 0;
      const sourceStock = transferDirection === "F1_TO_F2" ? f1 : f2;
      return sourceStock > 0;
    });
    if (!debouncedTransferSearch.trim()) return avail;
    return filterAndRankBySearch(avail, debouncedTransferSearch, (p) => [
      { text: p.code, weight: 1.5 },
      { text: p.name, weight: 1.3 },
      { text: p.categoryName, weight: 0.9 },
    ]);
  }, [products, transferDirection, debouncedTransferSearch]);

  const getSourceFloorStock = (p?: Product): number => {
    if (!p) return 0;
    const f1 = Number(p.stockFloor1 ?? p.stock) || 0;
    const f2 = Number(p.stockFloor2) || 0;
    return transferDirection === "F1_TO_F2" ? f1 : f2;
  };

  const handleChangeTransferDirection = (dir: "F1_TO_F2" | "F2_TO_F1") => {
    setTransferDirection(dir);
    setTransferItems([]);
    setTransferSearch("");
    const avail = products.filter((p) => {
      const f1 = Number(p.stockFloor1 ?? p.stock) || 0;
      const f2 = Number(p.stockFloor2) || 0;
      return (dir === "F1_TO_F2" ? f1 : f2) > 0;
    });
    setTransferProductId(avail[0]?._id || "");
    setTransferQty(1);
  };

  const handleAddTransferItem = (prodId?: string, qtyToAdd?: number) => {
    setStatusMsg(null);
    const targetId = prodId || transferProductId || sourceFloorProducts[0]?._id;
    if (!targetId) {
      setStatusMsg({
        type: "error",
        text: "Không có sản phẩm nào còn tồn ở kho đầu dời để chọn.",
      });
      return;
    }
    const prod = products.find((p) => p._id === targetId);
    if (!prod) return;
    const maxAvail = getSourceFloorStock(prod);
    if (maxAvail <= 0) {
      setStatusMsg({
        type: "error",
        text: `Sản phẩm "${prod.name}" không còn tồn ở kho đầu dời.`,
      });
      return;
    }
    const addQty = Math.max(1, Math.round(Number(qtyToAdd ?? transferQty) || 1));

    setTransferItems((prev) => {
      const existing = prev.find((i) => i.productId === targetId);
      if (existing) {
        const nextQty = Math.min(maxAvail, existing.quantity + addQty);
        return prev.map((i) =>
          i.productId === targetId ? { ...i, quantity: nextQty } : i
        );
      }
      return [
        ...prev,
        { productId: targetId, quantity: Math.min(maxAvail, addQty) },
      ];
    });
    setTransferQty(1);
  };

  const handleUpdateTransferItemQty = (prodId: string, newQty: number) => {
    const prod = products.find((p) => p._id === prodId);
    const maxAvail = getSourceFloorStock(prod);
    if (newQty <= 0) {
      setTransferItems((prev) => prev.filter((i) => i.productId !== prodId));
      return;
    }
    const clamped = Math.min(maxAvail, Math.max(1, Math.round(newQty)));
    setTransferItems((prev) =>
      prev.map((i) =>
        i.productId === prodId ? { ...i, quantity: clamped } : i
      )
    );
  };

  const handleRemoveTransferItem = (prodId: string) => {
    setTransferItems((prev) => prev.filter((i) => i.productId !== prodId));
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    // Nếu danh sách phiếu đang trống mà Admin chọn 1 SP trên thanh chọn nhanh thì lấy luôn SP đó
    const finalItems =
      transferItems.length > 0
        ? transferItems
        : transferProductId && Number(transferQty) > 0
        ? [{ productId: transferProductId, quantity: Math.round(Number(transferQty)) }]
        : [];

    if (finalItems.length === 0) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng thêm ít nhất 1 sản phẩm vào phiếu xuất kho chuyển tầng.",
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
          fromWarehouse,
          toWarehouse,
          items: finalItems,
          note: transferNote.trim(),
        }),
      });
      const code =
        res?.data?.referenceCode || res?.data?.movement?.referenceCode || "PXK";
      const fromText = fromWarehouse === "FLOOR_1" ? "Kho Tầng 1" : "Kho Tầng 2";
      const toText = toWarehouse === "FLOOR_1" ? "Kho Tầng 1" : "Kho Tầng 2";
      const totalUnits = finalItems.reduce((s, i) => s + i.quantity, 0);
      setStatusMsg({
        type: "success",
        text: `Đã tạo Phiếu Xuất Kho ${code}: Dời ${finalItems.length} mặt hàng (tổng ${totalUnits} SP) từ ${fromText} sang ${toText} & ghi nhận vào Hoạt động nhân viên!`,
      });
      setTransferItems([]);
      setTransferQty(1);
      setTransferNote("");
      setExpandedTransferCode(code);
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

  // Tập mã hàng đã từng nhập vào Kho Tầng 1 và Kho Tầng 2 (từ danh sách Phiếu nhập)
  const floor1ImportedCodes = new Set<string>();
  const floor2ImportedCodes = new Set<string>();
  importsList.forEach((rc) => {
    const wh = rc.targetWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1";
    (rc.items || []).forEach((it: any) => {
      if (it.productCode) {
        if (wh === "FLOOR_2") floor2ImportedCodes.add(String(it.productCode));
        else floor1ImportedCodes.add(String(it.productCode));
      }
    });
  });

  // Lọc sản phẩm theo Kho đang chọn (Kho Tầng 1 / Kho Tầng 2 / Xem gộp cả 2 Kho) + Smart Search tức thì
  const displayedProducts = useMemo(() => {
    const byFloor = products.filter((p) => {
      const f1 = Number(p.stockFloor1 ?? p.stock ?? 0);
      const f2 = Number(p.stockFloor2 ?? 0);
      if (activeWarehouse === "FLOOR_1") {
        if (showZeroFloorItems) return true;
        return f1 > 0 || floor1ImportedCodes.has(p.code) || !floor2ImportedCodes.has(p.code);
      }
      if (activeWarehouse === "FLOOR_2") {
        if (showZeroFloorItems) return true;
        return f2 > 0 || floor2ImportedCodes.has(p.code);
      }
      return true;
    });
    if (!search.trim()) return byFloor;
    return filterAndRankBySearch(byFloor, search, (p) => [
      { text: p.code, weight: 1.5 },
      { text: p.name, weight: 1.3 },
      { text: p.categoryName, weight: 0.9 },
      { text: p.unit, weight: 0.6 },
    ]);
  }, [products, activeWarehouse, showZeroFloorItems, importsList, search]);

  // Thống kê tổng hợp riêng cho Kho Tầng 1, Kho Tầng 2 và Kho đang chọn
  const totalFloor1Qty = products.reduce(
    (s, p) => s + (Number(p.stockFloor1 ?? p.stock) || 0),
    0
  );
  const totalFloor2Qty = products.reduce(
    (s, p) => s + (Number(p.stockFloor2) || 0),
    0
  );
  const getActiveQty = (p: Product) => {
    const f1 = Number(p.stockFloor1 ?? p.stock ?? 0);
    const f2 = Number(p.stockFloor2 ?? 0);
    if (activeWarehouse === "FLOOR_1") return f1;
    if (activeWarehouse === "FLOOR_2") return f2;
    return f1 + f2;
  };

  const totalStockQty = displayedProducts.reduce((s, p) => s + getActiveQty(p), 0);
  const totalCostInventoryValue = displayedProducts.reduce(
    (s, p) => s + getActiveQty(p) * (Number(editingCosts[p._id] ?? p.costPrice) || 0),
    0
  );
  const totalSellInventoryValue = displayedProducts.reduce(
    (s, p) => s + getActiveQty(p) * (Number(editingPrices[p._id] ?? p.sellingPrice) || 0),
    0
  );
  const totalExpectedMargin = totalSellInventoryValue - totalCostInventoryValue;

  // Map tra cứu nhanh sản phẩm theo mã/id cho Phiếu nhập
  const productByCode = new Map(products.map((p) => [p.code, p]));
  const activeWarehouseLabel =
    activeWarehouse === "FLOOR_1"
      ? "🏢 Kho Tầng 1"
      : activeWarehouse === "FLOOR_2"
      ? "🏬 Kho Tầng 2"
      : "📊 Tổng hợp Cả 2 Kho (Tầng 1 + Tầng 2)";

  // Reset trang về 1 khi thay đổi bộ lọc
  useEffect(() => {
    setProdPage(1);
  }, [activeWarehouse, showZeroFloorItems, search, categoryId, prodPageSize]);

  useEffect(() => {
    setReportPage(1);
  }, [activeWarehouse, fromDate, toDate, categoryId, reportPageSize]);

  useEffect(() => {
    setMovPage(1);
  }, [activeWarehouse, movementType, fromDate, toDate, movPageSize]);

  useEffect(() => {
    setImpPage(1);
  }, [activeWarehouse, impPageSize]);

  const prodTotalPages =
    prodPageSize <= 0
      ? 1
      : Math.max(1, Math.ceil(displayedProducts.length / prodPageSize));
  const safeProdPage = Math.min(prodPage, prodTotalPages);
  const pagedProducts =
    prodPageSize <= 0
      ? displayedProducts
      : displayedProducts.slice(
          (safeProdPage - 1) * prodPageSize,
          safeProdPage * prodPageSize
        );

  const filteredReportRows = reportRows.filter((r) => {
    if (activeWarehouse === "FLOOR_1") {
      return (
        (Number(r.stockFloor1 ?? r.closingStock) || 0) > 0 ||
        floor1ImportedCodes.has(r.productCode)
      );
    }
    if (activeWarehouse === "FLOOR_2") {
      return (
        (Number(r.stockFloor2) || 0) > 0 ||
        floor2ImportedCodes.has(r.productCode)
      );
    }
    return true;
  });
  const reportTotalPages =
    reportPageSize <= 0
      ? 1
      : Math.max(1, Math.ceil(filteredReportRows.length / reportPageSize));
  const safeReportPage = Math.min(reportPage, reportTotalPages);
  const pagedReportRows =
    reportPageSize <= 0
      ? filteredReportRows
      : filteredReportRows.slice(
          (safeReportPage - 1) * reportPageSize,
          safeReportPage * reportPageSize
        );

  const filteredMovements = movements.filter((m) => {
    if (activeWarehouse === "ALL") return true;
    const loc = m.warehouseLocation || "FLOOR_1";
    return loc === activeWarehouse;
  });
  const movTotalPages =
    movPageSize <= 0
      ? 1
      : Math.max(1, Math.ceil(filteredMovements.length / movPageSize));
  const safeMovPage = Math.min(movPage, movTotalPages);
  const pagedMovements =
    movPageSize <= 0
      ? filteredMovements
      : filteredMovements.slice(
          (safeMovPage - 1) * movPageSize,
          safeMovPage * movPageSize
        );

  const filteredImports = importsList.filter((imp) => {
    if (activeWarehouse === "ALL") return true;
    const wh = imp.targetWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1";
    return wh === activeWarehouse;
  });
  const impTotalPages =
    impPageSize <= 0
      ? 1
      : Math.max(1, Math.ceil(filteredImports.length / impPageSize));
  const safeImpPage = Math.min(impPage, impTotalPages);
  const pagedImports =
    impPageSize <= 0
      ? filteredImports
      : filteredImports.slice(
          (safeImpPage - 1) * impPageSize,
          safeImpPage * impPageSize
        );

  const renderPaginationBar = (opts: {
    totalItems: number;
    page: number;
    totalPages: number;
    pageSize: number;
    onPageChange: (p: number) => void;
    onPageSizeChange: (sz: number) => void;
    itemLabel?: string;
  }) => {
    const {
      totalItems,
      page,
      totalPages,
      pageSize,
      onPageChange,
      onPageSizeChange,
      itemLabel = "mặt hàng",
    } = opts;
    if (totalItems === 0) return null;
    const startIdx = pageSize <= 0 ? 1 : (page - 1) * pageSize + 1;
    const endIdx =
      pageSize <= 0 ? totalItems : Math.min(page * pageSize, totalItems);

    const pages: number[] = [];
    const maxButtons = 5;
    let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    for (let i = startPage; i <= endPage; i++) pages.push(i);

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Hiển thị{" "}
            <strong className="text-slate-900 font-mono">
              {startIdx}–{endIdx}
            </strong>{" "}
            trên tổng{" "}
            <strong className="text-emerald-700 font-mono">{totalItems}</strong>{" "}
            {itemLabel}
          </span>
          <span className="text-slate-300">|</span>
          <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <span>Số dòng/trang:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-900"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>Tất cả ({totalItems})</option>
            </select>
          </label>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(1)}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              title="Trang đầu"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-bold inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Trước
            </button>

            {pages.map((pNum) => (
              <button
                key={pNum}
                type="button"
                onClick={() => onPageChange(pNum)}
                className={`w-8 h-8 rounded-lg font-mono font-extrabold text-xs transition ${
                  pNum === page
                    ? "bg-emerald-600 text-white shadow"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {pNum}
              </button>
            ))}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-bold inline-flex items-center gap-1"
            >
              Tiếp <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(totalPages)}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              title="Trang cuối"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* THANH CHỌN KHO (CHIA RIÊNG KHO TẦNG 1 VÀ KHO TẦNG 2) */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase text-emerald-400">
            Hệ thống Quản lý 2 Kho tách biệt — 11Sport
          </div>
          <h2 className="text-base font-extrabold mt-0.5">
            Đang quản lý: <span className="text-emerald-300">{activeWarehouseLabel}</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => handleSelectWarehouseTab("FLOOR_1")}
            className={`px-4 py-2.5 rounded-xl text-left transition border-2 ${
              activeWarehouse === "FLOOR_1"
                ? "bg-emerald-500 text-slate-950 border-emerald-300 shadow-lg"
                : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <div className="text-xs font-extrabold flex items-center justify-between gap-2">
              <span>🏢 KHO TẦNG 1</span>
              <span className="font-mono text-sm">
                {totalFloor1Qty.toLocaleString("vi-VN")} SP
              </span>
            </div>
            <div
              className={`text-[10px] mt-0.5 ${
                activeWarehouse === "FLOOR_1" ? "text-slate-900 font-semibold" : "text-slate-400"
              }`}
            >
              Quản lý tồn & giá bán Kho Tầng 1
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectWarehouseTab("FLOOR_2")}
            className={`px-4 py-2.5 rounded-xl text-left transition border-2 ${
              activeWarehouse === "FLOOR_2"
                ? "bg-purple-500 text-white border-purple-300 shadow-lg"
                : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <div className="text-xs font-extrabold flex items-center justify-between gap-2">
              <span>🏬 KHO TẦNG 2</span>
              <span className="font-mono text-sm">
                {totalFloor2Qty.toLocaleString("vi-VN")} SP
              </span>
            </div>
            <div
              className={`text-[10px] mt-0.5 ${
                activeWarehouse === "FLOOR_2" ? "text-purple-100 font-semibold" : "text-slate-400"
              }`}
            >
              Quản lý tồn & giá bán Kho Tầng 2
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectWarehouseTab("ALL")}
            className={`px-4 py-2.5 rounded-xl text-left transition border-2 ${
              activeWarehouse === "ALL"
                ? "bg-blue-500 text-white border-blue-300 shadow-lg"
                : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <div className="text-xs font-extrabold flex items-center justify-between gap-2">
              <span>📊 XEM GỘP 2 KHO</span>
              <span className="font-mono text-sm">
                {(totalFloor1Qty + totalFloor2Qty).toLocaleString("vi-VN")} SP
              </span>
            </div>
            <div
              className={`text-[10px] mt-0.5 ${
                activeWarehouse === "ALL" ? "text-blue-100 font-semibold" : "text-slate-400"
              }`}
            >
              So sánh Tầng 1 + Tầng 2 trên cùng bảng
            </div>
          </button>
        </div>
      </div>

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
          {/* 4 Thẻ KPI Tổng hợp Số lượng, Giá gốc, Giá bán theo Kho đang chọn */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-slate-500">
                Tổng tồn {activeWarehouseLabel} ({displayedProducts.length} mã SP)
              </div>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">
                {totalStockQty.toLocaleString("vi-VN")}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {activeWarehouse === "ALL"
                  ? `Tầng 1: ${totalFloor1Qty.toLocaleString("vi-VN")} · Tầng 2: ${totalFloor2Qty.toLocaleString("vi-VN")}`
                  : `Đơn vị sản phẩm đang có tại ${activeWarehouseLabel}`}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-slate-500">
                Giá trị {activeWarehouseLabel} (Theo Giá gốc)
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
                Giá trị {activeWarehouseLabel} (Theo Giá bán)
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-700 mt-1">
                {formatVND(totalSellInventoryValue)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Doanh thu dự kiến của {activeWarehouseLabel}
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-emerald-400">
                Lãi gộp dự kiến ({activeWarehouseLabel})
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Mã tự sinh: {generateProductCode(newProdName)}
                  </span>
                  {(() => {
                    const code = generateProductCode(newProdName);
                    const matched = (allCatalogProducts.length > 0 ? allCatalogProducts : products).find(
                      (p) => p.code === code
                    );
                    if (!matched) return null;
                    return (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                        ✓ Đã có trong kho (Tồn: {matched.stock} {matched.unit || "Cái"} — sẽ cộng thêm SL)
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-3 relative">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Tên hàng hóa (Gõ để gợi ý SP có trong kho) *
                </label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onFocus={() => {
                    setShowNewProdSuggestions(true);
                    setNewProdHighlightIdx(0);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowNewProdSuggestions(false), 180);
                  }}
                  onChange={(e) => {
                    setNewProdName(e.target.value);
                    setShowNewProdSuggestions(true);
                    setNewProdHighlightIdx(0);
                  }}
                  onKeyDown={(e) => {
                    if (!showNewProdSuggestions || newProdSuggestions.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setNewProdHighlightIdx((prev) => (prev + 1) % newProdSuggestions.length);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setNewProdHighlightIdx(
                        (prev) => (prev - 1 + newProdSuggestions.length) % newProdSuggestions.length
                      );
                    } else if (e.key === "Enter") {
                      const picked =
                        newProdSuggestions[newProdHighlightIdx] || newProdSuggestions[0];
                      if (picked && picked.name !== newProdName) {
                        e.preventDefault();
                        handleSelectNewProdSuggestion(picked);
                      }
                    } else if (e.key === "Escape") {
                      setShowNewProdSuggestions(false);
                    }
                  }}
                  placeholder="Gõ tên hoặc mã SP để chọn gợi ý hoặc tạo mới..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-600 focus:outline-none text-xs font-medium text-slate-900"
                />

                {showNewProdSuggestions && newProdSuggestions.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 z-40 w-full sm:w-[440px] bg-white rounded-xl border-2 border-emerald-500 shadow-2xl overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold flex items-center justify-between gap-2">
                      <span>
                        📦 Gợi ý sản phẩm có sẵn trong kho ({newProdSuggestions.length} SP)
                      </span>
                      <span className="text-emerald-300 font-normal">
                        Bấm chọn hoặc nhấn ↑↓ + Enter
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {newProdSuggestions.map((p, sIdx) => {
                        const f1 = Number(p.stockFloor1 ?? p.stock ?? 0);
                        const f2 = Number(p.stockFloor2 ?? 0);
                        const isHighlighted = sIdx === newProdHighlightIdx;
                        return (
                          <button
                            key={p._id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectNewProdSuggestion(p);
                            }}
                            onMouseEnter={() => setNewProdHighlightIdx(sIdx)}
                            className={`w-full text-left px-3 py-2 transition flex flex-col gap-0.5 ${
                              isHighlighted ? "bg-emerald-50/90" : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="font-bold text-xs text-slate-900 leading-snug break-words">
                              {p.name}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {p.code}
                                </span>
                                <span>ĐVT: {p.unit || "Cái"}</span>
                                <span className="text-emerald-700 font-bold">
                                  Tồn: {p.stock} (T1: {f1} · T2: {f2})
                                </span>
                              </div>
                              <div className="flex items-center gap-2 font-mono">
                                {Number(p.costPrice) > 0 && (
                                  <span className="text-amber-700 font-semibold">
                                    Gốc: {formatVND(Number(p.costPrice))}
                                  </span>
                                )}
                                {Number(p.sellingPrice) > 0 && (
                                  <span className="text-emerald-700 font-bold">
                                    Bán: {formatVND(Number(p.sellingPrice))}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                  disabled={!newProdName.trim() || newProdQty <= 0}
                  className={`w-full py-2 px-2.5 rounded-lg font-bold text-xs whitespace-nowrap transition ${
                    newProdName.trim() && newProdQty > 0
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  + Nhập kho
                </button>
              </div>
            </div>
          </form>

          {/* MỤC XEM LẠI CHI TIẾT KHI NHẬP HÀNG VÀO KHO (PHIẾU NHẬP PN-... & NHẬP THẲNG CMS) */}
          <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/60 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-indigo-600 text-white shadow-sm">
                  <History className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <span>Xem Lại Chi Tiết Khi Nhập Hàng Vào Kho</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-indigo-100 text-indigo-800">
                      {importsList.length} phiếu nhập ·{" "}
                      {movements.filter((m) => m.type === "IMPORT" && m.referenceCode === "CMS-NHAP-THANG").length} lượt nhập thẳng
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Lưu vết đầy đủ thông tin Người nhập (<strong className="text-purple-700">ADMIN</strong> hoặc{" "}
                    <strong className="text-teal-700">WAREHOUSE</strong>), kho nhận, số lượng, giá gốc và giá bán.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {showRecentImportsSection && (
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setRecentImportRoleFilter("ALL")}
                      className={`px-2.5 py-1 rounded-md transition ${
                        recentImportRoleFilter === "ALL"
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Tất cả vai trò
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecentImportRoleFilter("ADMIN")}
                      className={`px-2.5 py-1 rounded-md transition ${
                        recentImportRoleFilter === "ADMIN"
                          ? "bg-purple-700 text-white"
                          : "text-purple-700 hover:bg-purple-50"
                      }`}
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecentImportRoleFilter("WAREHOUSE")}
                      className={`px-2.5 py-1 rounded-md transition ${
                        recentImportRoleFilter === "WAREHOUSE"
                          ? "bg-teal-700 text-white"
                          : "text-teal-700 hover:bg-teal-50"
                      }`}
                    >
                      Warehouse
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowRecentImportsSection((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showRecentImportsSection ? "Thu gọn mục xem lại" : "Xem lại chi tiết nhập hàng"}
                </button>
              </div>
            </div>

            {showRecentImportsSection && (
              <div className="p-4 space-y-3">
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900 text-white uppercase text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Mã phiếu / Chứng từ</th>
                        <th className="py-2.5 px-3">Thời gian nhập</th>
                        <th className="py-2.5 px-3">Kho nhận</th>
                        <th className="py-2.5 px-3">Người nhập (Admin / Warehouse)</th>
                        <th className="py-2.5 px-3">Người kiểm / Hoàn thành</th>
                        <th className="py-2.5 px-3 text-right">Số SP</th>
                        <th className="py-2.5 px-3 text-right">Tổng SL nhập</th>
                        <th className="py-2.5 px-3 text-right">Tổng giá gốc</th>
                        <th className="py-2.5 px-3 text-center">Xem chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(() => {
                        // Kết hợp Phiếu nhập kho (PN-...) và Lượt nhập thẳng CMS (CMS-NHAP-THANG)
                        const combinedEntries: any[] = [];

                        importsList.forEach((imp) => {
                          const wh = imp.targetWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1";
                          if (activeWarehouse !== "ALL" && wh !== activeWarehouse) return;
                          const creatorRole = String(imp.createdByRole || "ADMIN").toUpperCase();
                          const completerRole = String(imp.completedByRole || "").toUpperCase();
                          if (
                            recentImportRoleFilter !== "ALL" &&
                            creatorRole !== recentImportRoleFilter &&
                            completerRole !== recentImportRoleFilter
                          ) {
                            return;
                          }
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
                          combinedEntries.push({
                            _id: imp._id,
                            entryType: "RECEIPT",
                            code: imp.code || imp.receiptCode || imp._id,
                            createdAt: imp.createdAt,
                            targetWarehouse: wh,
                            status: imp.status,
                            createdByName: imp.createdByName || "Quản trị viên",
                            createdByRole: imp.createdByRole || "ADMIN",
                            completedByName: imp.completedByName,
                            completedByRole: imp.completedByRole,
                            itemCount: items.length,
                            totalQty,
                            totalCost,
                            rawReceipt: imp,
                          });
                        });

                        movements
                          .filter((m) => m.type === "IMPORT" && m.referenceCode === "CMS-NHAP-THANG")
                          .forEach((m) => {
                            const wh = m.warehouseLocation === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1";
                            if (activeWarehouse !== "ALL" && wh !== activeWarehouse) return;
                            const role = String(m.performedByRole || "ADMIN").toUpperCase();
                            if (recentImportRoleFilter !== "ALL" && role !== recentImportRoleFilter) {
                              return;
                            }
                            const qty = Math.abs(Number(m.quantityChange) || 0);
                            const cost = Number(m.costPrice || 0);
                            const sell = Number(m.sellingPrice || 0);
                            combinedEntries.push({
                              _id: `mov-${m._id}`,
                              entryType: "DIRECT_CMS",
                              code: `CMS-NHAP-THANG`,
                              createdAt: m.createdAt,
                              targetWarehouse: wh,
                              status: "COMPLETED",
                              createdByName: m.performedByName || "Quản lý (Admin)",
                              createdByRole: m.performedByRole || "ADMIN",
                              completedByName: m.performedByName || "Quản lý (Admin)",
                              completedByRole: m.performedByRole || "ADMIN",
                              itemCount: 1,
                              totalQty: qty,
                              totalCost: qty * cost,
                              rawReceipt: {
                                _id: m._id,
                                code: `CMS-NHAP-THANG (${m.productCode})`,
                                status: "COMPLETED",
                                targetWarehouse: wh,
                                createdByName: m.performedByName || "Quản lý (Admin)",
                                createdByRole: m.performedByRole || "ADMIN",
                                completedByName: m.performedByName || "Quản lý (Admin)",
                                completedByRole: m.performedByRole || "ADMIN",
                                createdAt: m.createdAt,
                                completedAt: m.createdAt,
                                note: m.note || "Nhập thẳng sản phẩm vào kho từ CMS",
                                items: [
                                  {
                                    stt: 1,
                                    productCode: m.productCode,
                                    productName: m.productName,
                                    unit: productByCode.get(m.productCode)?.unit || "Cái",
                                    expectedQuantity: qty,
                                    actualQuantity: qty,
                                    costPrice: cost,
                                    sellingPrice: sell,
                                    checkedByName: m.performedByName || "Quản lý (Admin)",
                                    checkedByRole: m.performedByRole || "ADMIN",
                                    isConfirmed: true,
                                  },
                                ],
                              },
                            });
                          });

                        combinedEntries.sort(
                          (a, b) =>
                            new Date(b.createdAt || 0).getTime() -
                            new Date(a.createdAt || 0).getTime()
                        );

                        const topEntries = combinedEntries.slice(0, 15);
                        if (topEntries.length === 0) {
                          return (
                            <tr>
                              <td colSpan={9} className="py-6 text-center text-slate-400">
                                Chưa có dữ liệu nhập hàng nào khớp bộ lọc.
                              </td>
                            </tr>
                          );
                        }

                        return topEntries.map((entry) => (
                          <tr key={entry._id} className="hover:bg-indigo-50/40">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {entry.code}
                              {entry.entryType === "DIRECT_CMS" && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-amber-100 text-amber-800">
                                  Nhập thẳng
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                              {formatDateTime(entry.createdAt)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  entry.targetWarehouse === "FLOOR_2"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {entry.targetWarehouse === "FLOOR_2"
                                  ? "🏬 Kho Tầng 2"
                                  : "🏢 Kho Tầng 1"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800">
                                  {entry.createdByName}
                                </span>
                                <CmsRoleBadge role={entry.createdByRole} compact />
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {entry.completedByName ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-700">
                                    {entry.completedByName}
                                  </span>
                                  <CmsRoleBadge role={entry.completedByRole} compact />
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Đang xử lý ({entry.status})</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              {entry.itemCount} SP
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700">
                              +{entry.totalQty}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800 whitespace-nowrap">
                              {formatVND(entry.totalCost)}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setDetailModalReceipt(entry.rawReceipt)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[11px] inline-flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" /> Xem chi tiết
                              </button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Bảng danh sách sản phẩm: Chia rõ Kho Tầng 1 & Kho Tầng 2 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <span>Danh mục Sản phẩm — {activeWarehouseLabel}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-100 text-emerald-800">
                    {displayedProducts.length} mặt hàng · {totalStockQty.toLocaleString("vi-VN")} đơn vị
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeWarehouse === "FLOOR_1"
                    ? "Đang xem và chỉnh sửa trực tiếp tồn kho tại Kho Tầng 1. Bấm sang tab 'Kho Tầng 2' ở trên để quản lý riêng Kho Tầng 2."
                    : activeWarehouse === "FLOOR_2"
                    ? "Đang xem và chỉnh sửa trực tiếp tồn kho tại Kho Tầng 2. Có thể bật 'Hiện toàn bộ SP' nếu muốn nhập số lượng Tầng 2 cho các mã hàng khác."
                    : "Đang xem gộp cả 2 kho: có thể chỉnh sửa riêng cột Tồn Kho Tầng 1 và Tồn Kho Tầng 2 trên cùng một dòng."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {changedProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetProductEdits}
                    disabled={savingBatch}
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition"
                    title="Hoàn tác các thay đổi chưa lưu"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Hoàn tác ({changedProducts.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveAllProductChanges}
                  disabled={changedProducts.length === 0 || savingBatch}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition ${
                    changedProducts.length > 0 && !savingBatch
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md ring-2 ring-emerald-200 cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                  title={
                    changedProducts.length > 0
                      ? `Lưu toàn bộ ${changedProducts.length} sản phẩm đã thay đổi`
                      : "Chưa có thay đổi nào về số lượng hoặc thông tin sản phẩm"
                  }
                >
                  <Save className="w-4 h-4" />
                  {savingBatch
                    ? "Đang lưu..."
                    : changedProducts.length > 0
                    ? `Lưu thay đổi (${changedProducts.length} SP)`
                    : "Lưu thay đổi"}
                </button>
                {activeWarehouse !== "ALL" && (
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-2 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showZeroFloorItems}
                      onChange={(e) => setShowZeroFloorItems(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Hiện cả SP ngoài {activeWarehouse === "FLOOR_2" ? "Tầng 2" : "Tầng 1"} ({products.length} SP)
                  </label>
                )}
                <ExportExcelButton
                  onExport={() => exportProducts(displayedProducts)}
                  disabled={displayedProducts.length === 0}
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
                    <th className="py-3 px-2.5 w-12 text-center">STT</th>
                    <th className="py-3 px-2.5 max-w-[180px]">Mã hàng</th>
                    <th className="py-3 px-2.5 min-w-[220px]">Tên sản phẩm</th>
                    <th className="py-3 px-2.5 w-32">Category</th>
                    <th className="py-3 px-2 text-center w-16">ĐVT</th>
                    {(activeWarehouse === "FLOOR_1" || activeWarehouse === "ALL") && (
                      <th className="py-3 px-2.5 text-right w-32 whitespace-nowrap bg-emerald-950 text-emerald-300">
                        🏢 Tồn Kho Tầng 1
                      </th>
                    )}
                    {(activeWarehouse === "FLOOR_2" || activeWarehouse === "ALL") && (
                      <th className="py-3 px-2.5 text-right w-32 whitespace-nowrap bg-purple-950 text-purple-300">
                        🏬 Tồn Kho Tầng 2
                      </th>
                    )}
                    {activeWarehouse === "ALL" && (
                      <th className="py-3 px-2.5 text-right w-24 whitespace-nowrap bg-slate-800">
                        Tổng 2 Kho
                      </th>
                    )}
                    <th className="py-3 px-2.5 text-right w-36 whitespace-nowrap">Giá gốc (VND)</th>
                    <th className="py-3 px-2.5 text-right w-36 whitespace-nowrap">Giá bán lẻ (VND)</th>
                    <th className="py-3 px-2.5 text-right w-36 whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pagedProducts.map((p, idx) => {
                    const rowStt =
                      prodPageSize <= 0
                        ? idx + 1
                        : (safeProdPage - 1) * prodPageSize + idx + 1;
                    const nameVal = editingNames[p._id] ?? p.name ?? "";
                    const catVal =
                      editingCats[p._id] ??
                      (typeof p.categoryId === "object"
                        ? p.categoryId?._id || ""
                        : String(p.categoryId || ""));
                    const unitVal = editingUnits[p._id] ?? p.unit ?? "Cái";
                    const origF1 = Number(p.stockFloor1 ?? p.stock ?? 0);
                    const origF2 = Number(p.stockFloor2 ?? 0);
                    const f1Val = Number(editingFloor1[p._id] ?? origF1);
                    const f2Val = Number(editingFloor2[p._id] ?? origF2);
                    const activeQty =
                      activeWarehouse === "FLOOR_1"
                        ? f1Val
                        : activeWarehouse === "FLOOR_2"
                        ? f2Val
                        : f1Val + f2Val;
                    const costVal = Number(editingCosts[p._id] ?? p.costPrice ?? 0);
                    const sellVal = Number(editingPrices[p._id] ?? p.sellingPrice ?? 0);
                    const margin = sellVal - costVal;
                    return (
                      <tr key={p._id} className="hover:bg-slate-50">
                        <td className="py-3 px-2 text-center font-mono font-bold text-slate-400 align-top">
                          {rowStt}
                        </td>
                        <td className="py-3 px-2.5 font-mono font-bold text-slate-800 align-top break-all max-w-[180px] text-[11px] leading-snug">
                          {p.code}
                        </td>
                        <td className="py-3 px-2.5 align-top">
                          <textarea
                            rows={Math.max(2, Math.ceil((nameVal.length || 0) / 42))}
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
                        <td className="py-3 px-2.5 align-top">
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
                        <td className="py-3 px-2 text-center align-top">
                          <input
                            type="text"
                            value={unitVal}
                            onChange={(e) =>
                              setEditingUnits((prev) => ({
                                ...prev,
                                [p._id]: e.target.value,
                              }))
                            }
                            className="w-14 px-1.5 py-1.5 rounded border border-slate-300 text-center"
                          />
                        </td>

                        {(activeWarehouse === "FLOOR_1" || activeWarehouse === "ALL") && (
                          <td className="py-3 px-2.5 text-right align-top bg-emerald-50/30">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={f1Val}
                              onChange={(e) =>
                                setEditingFloor1((prev) => ({
                                  ...prev,
                                  [p._id]: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                }))
                              }
                              className={`w-24 px-2 py-1.5 rounded border text-right font-mono font-extrabold ${
                                f1Val !== origF1
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                                  : "border-slate-300 bg-white text-emerald-700"
                              }`}
                            />
                            {activeWarehouse === "FLOOR_1" && origF2 > 0 && (
                              <div className="mt-1 text-[10px] text-purple-700 font-mono">
                                (Kho Tầng 2 đang có: <b>{origF2}</b>)
                              </div>
                            )}
                            {f1Val !== origF1 && (
                              <div className="mt-0.5 text-[10px] font-mono font-bold text-emerald-700">
                                Hiện tại: {origF1} ({f1Val > origF1 ? `+${f1Val - origF1}` : f1Val - origF1})
                              </div>
                            )}
                          </td>
                        )}

                        {(activeWarehouse === "FLOOR_2" || activeWarehouse === "ALL") && (
                          <td className="py-3 px-2.5 text-right align-top bg-purple-50/30">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={f2Val}
                              onChange={(e) =>
                                setEditingFloor2((prev) => ({
                                  ...prev,
                                  [p._id]: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                }))
                              }
                              className={`w-24 px-2 py-1.5 rounded border text-right font-mono font-extrabold ${
                                f2Val !== origF2
                                  ? "border-purple-500 bg-purple-50 text-purple-900"
                                  : "border-slate-300 bg-white text-purple-700"
                              }`}
                            />
                            {activeWarehouse === "FLOOR_2" && origF1 > 0 && (
                              <div className="mt-1 text-[10px] text-emerald-700 font-mono">
                                (Kho Tầng 1 đang có: <b>{origF1}</b>)
                              </div>
                            )}
                            {f2Val !== origF2 && (
                              <div className="mt-0.5 text-[10px] font-mono font-bold text-purple-700">
                                Hiện tại: {origF2} ({f2Val > origF2 ? `+${f2Val - origF2}` : f2Val - origF2})
                              </div>
                            )}
                          </td>
                        )}

                        {activeWarehouse === "ALL" && (
                          <td className="py-3 px-2.5 text-right align-top font-mono font-extrabold text-slate-900 bg-slate-50">
                            <div className="py-1.5">{f1Val + f2Val}</div>
                          </td>
                        )}

                        <td className="py-3 px-2.5 text-right align-top">
                          <div className="relative inline-block w-32">
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
                              className={`w-full pl-2 pr-9 py-1.5 rounded border text-right font-mono font-bold ${
                                costVal === 0
                                  ? "border-orange-300 bg-orange-50 text-orange-900"
                                  : "border-slate-300 bg-white text-slate-800"
                              }`}
                            />
                            <span className="absolute right-2 top-2 text-[10px] font-mono font-bold text-slate-400 pointer-events-none">
                              VND
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500 font-mono whitespace-nowrap">
                            Tổng vốn: {formatVND(activeQty * costVal)}
                          </div>
                        </td>
                        <td className="py-3 px-2.5 text-right align-top">
                          <div className="relative inline-block w-32">
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
                              className={`w-full pl-2 pr-9 py-1.5 rounded border text-right font-mono font-bold ${
                                sellVal === 0
                                  ? "border-amber-400 bg-amber-50 text-amber-900"
                                  : "border-slate-300 bg-white text-slate-900"
                              }`}
                            />
                            <span className="absolute right-2 top-2 text-[10px] font-mono font-bold text-slate-400 pointer-events-none">
                              VND
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500 font-mono whitespace-nowrap">
                            Tổng bán: {formatVND(activeQty * sellVal)}
                          </div>
                          {sellVal > 0 && costVal > 0 && (
                            <div
                              className={`mt-0.5 text-[10px] font-bold whitespace-nowrap ${
                                margin < 0 ? "text-red-600" : "text-emerald-700"
                              }`}
                            >
                              {margin < 0 ? "Lỗ" : "Lãi"}: {formatVND(Math.abs(margin))}/SP (
                              {Math.round((margin / costVal) * 100)}%)
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2.5 text-right align-top whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {isProductChanged(p) && (
                              <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-extrabold">
                                Đã sửa
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setTransferProductId(p._id);
                                if (activeWarehouse === "FLOOR_2") {
                                  setTransferDirection("F2_TO_F1");
                                } else if (activeWarehouse === "FLOOR_1") {
                                  setTransferDirection("F1_TO_F2");
                                }
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
                {displayedProducts.length > 0 && (
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                    <tr>
                      <td colSpan={5} className="py-3 px-3 text-right uppercase">
                        Tổng toàn kho {activeWarehouseLabel} ({displayedProducts.length} mặt hàng):
                      </td>
                      {(activeWarehouse === "FLOOR_1" || activeWarehouse === "ALL") && (
                        <td className="py-3 px-2.5 text-right font-mono text-emerald-700">
                          {displayedProducts.reduce(
                            (s, p) => s + (Number(p.stockFloor1 ?? p.stock) || 0),
                            0
                          )}
                        </td>
                      )}
                      {(activeWarehouse === "FLOOR_2" || activeWarehouse === "ALL") && (
                        <td className="py-3 px-2.5 text-right font-mono text-purple-700">
                          {displayedProducts.reduce(
                            (s, p) => s + (Number(p.stockFloor2) || 0),
                            0
                          )}
                        </td>
                      )}
                      {activeWarehouse === "ALL" && (
                        <td className="py-3 px-2.5 text-right font-mono text-slate-900">
                          {totalStockQty}
                        </td>
                      )}
                      <td className="py-3 px-2.5 text-right font-mono text-amber-800 whitespace-nowrap">
                        {formatVND(totalCostInventoryValue)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono text-emerald-800 whitespace-nowrap">
                        {formatVND(totalSellInventoryValue)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {changedProducts.length > 0 && (
              <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900 text-white shadow-xl border border-emerald-500/40">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold font-mono">
                    {changedProducts.length} SP
                  </span>
                  <span>
                    đang có thay đổi số lượng tồn kho / giá chưa lưu. Bấm <strong>Lưu thay đổi</strong> để cập nhật toàn bộ cùng lúc.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetProductEdits}
                    disabled={savingBatch}
                    className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Hoàn tác
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAllProductChanges}
                    disabled={changedProducts.length === 0 || savingBatch}
                    className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 shadow"
                  >
                    <Save className="w-4 h-4" />
                    {savingBatch ? "Đang lưu..." : `Lưu thay đổi (${changedProducts.length} SP)`}
                  </button>
                </div>
              </div>
            )}

            {renderPaginationBar({
              totalItems: displayedProducts.length,
              page: safeProdPage,
              totalPages: prodTotalPages,
              pageSize: prodPageSize,
              onPageChange: setProdPage,
              onPageSizeChange: setProdPageSize,
              itemLabel: "mặt hàng trong kho",
            })}
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
                  Số lượng Tồn cuối kỳ = Tồn đầu kỳ + Nhập trong kỳ − Bán trong kỳ ± Điều chỉnh (Tách riêng Kho Tầng 1 & Kho Tầng 2)
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
                  <th className="py-3 px-2.5 text-right text-emerald-300 bg-slate-800 whitespace-nowrap">
                    🏢 Tồn Tầng 1
                  </th>
                  <th className="py-3 px-2.5 text-right text-blue-300 bg-slate-800 whitespace-nowrap">
                    🏬 Tồn Tầng 2
                  </th>
                  <th className="py-3 px-3 text-right font-extrabold bg-slate-800 whitespace-nowrap">
                    = Tổng 2 Kho
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
                {pagedReportRows.map((r, i) => {
                  const cost = Number(r.costPrice) || 0;
                  const sell = Number(r.sellingPrice) || 0;
                  const f1 = Number(r.stockFloor1 ?? r.closingStock) || 0;
                  const f2 = Number(r.stockFloor2) || 0;
                  const closing = Number(r.closingStock) || 0;
                  const activeQty = activeWarehouse === "FLOOR_1" ? f1 : activeWarehouse === "FLOOR_2" ? f2 : closing;
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
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40">
                        {f1}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-blue-700 bg-blue-50/40">
                        {f2}
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
                        {formatVND(activeQty * cost)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-800 bg-emerald-50/40 whitespace-nowrap">
                        {formatVND(activeQty * sell)}
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
                    <td className="py-3 px-2.5 text-right font-mono text-emerald-700">
                      {reportRows.reduce((s, r) => s + (Number(r.stockFloor1 ?? r.closingStock) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-blue-700">
                      {reportRows.reduce((s, r) => s + (Number(r.stockFloor2) || 0), 0)}
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

          {renderPaginationBar({
            totalItems: filteredReportRows.length,
            page: safeReportPage,
            totalPages: reportTotalPages,
            pageSize: reportPageSize,
            onPageChange: setReportPage,
            onPageSizeChange: setReportPageSize,
            itemLabel: "mặt hàng trong báo cáo",
          })}
        </div>
      )}

      {/* SUB-TAB 3: SỔ KHO (STOCK MOVEMENTS — SỐ LƯỢNG, GIÁ GỐC, GIÁ BÁN) */}
      {subTab === "MOVEMENTS" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Sổ Kho Kế Toán —{" "}
                {activeWarehouse === "FLOOR_1"
                  ? "🏢 Kho Tầng 1"
                  : activeWarehouse === "FLOOR_2"
                  ? "🏬 Kho Tầng 2"
                  : "📊 Cả 2 Kho"}{" "}
                (Stock Movements — BR-07)
              </h3>
              <p className="text-xs text-slate-500">
                Lưu vết toàn bộ lịch sử biến động tồn kho kèm Kho tầng, Số lượng, Giá gốc, Giá bán, mã chứng từ tham chiếu và nhân viên thực hiện.
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
                  <th className="py-3 px-3">Kho tầng</th>
                  <th className="py-3 px-3">Loại</th>
                  <th className="py-3 px-3">Sản phẩm</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">SL Biến động</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">SL Tồn sau GD</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá gốc (VND)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá bán (VND)</th>
                  <th className="py-3 px-3">Người thực hiện (Vai trò)</th>
                  <th className="py-3 px-3">Chứng từ</th>
                  <th className="py-3 px-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedMovements.map((m) => {
                  const fallbackProd = productByCode.get(m.productCode);
                  const cost = Number(m.costPrice ?? fallbackProd?.costPrice ?? 0);
                  const sell = Number(m.sellingPrice ?? fallbackProd?.sellingPrice ?? 0);
                  const loc = m.warehouseLocation || "FLOOR_1";
                  return (
                    <tr key={m._id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            loc === "FLOOR_2"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {loc === "FLOOR_2" ? "🏬 Kho Tầng 2" : "🏢 Kho Tầng 1"}
                        </span>
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
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800">
                            {m.performedByName || "Hệ thống"}
                          </span>
                          <CmsRoleBadge role={m.performedByRole} compact />
                        </div>
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

          {renderPaginationBar({
            totalItems: filteredMovements.length,
            page: safeMovPage,
            totalPages: movTotalPages,
            pageSize: movPageSize,
            onPageChange: setMovPage,
            onPageSizeChange: setMovPageSize,
            itemLabel: "bút toán sổ kho",
          })}
        </div>
      )}

      {/* SUB-TAB 4: DANH SÁCH PHIẾU NHẬP KHO (KÈM SỐ LƯỢNG, GIÁ GỐC, GIÁ BÁN) */}
      {subTab === "IMPORTS" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Danh sách Phiếu Nhập Kho —{" "}
                {activeWarehouse === "FLOOR_1"
                  ? "🏢 Kho Tầng 1"
                  : activeWarehouse === "FLOOR_2"
                  ? "🏬 Kho Tầng 2"
                  : "📊 Cả 2 Kho"}{" "}
                (BR-09, BR-10)
              </h3>
              <p className="text-xs text-slate-500">
                Bấm vào một dòng phiếu nhập hoặc nút <strong>Xem chi tiết</strong> để xem lại đầy đủ thông tin Người nhập (Admin hay Warehouse), Số lượng, Giá gốc, Giá bán.
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
                  <th className="py-3 px-3">Kho nhận</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-3 text-right">Số dòng</th>
                  <th className="py-3 px-3 text-right">Tổng SL thực nhận</th>
                  <th className="py-3 px-3 text-right">Tổng giá gốc</th>
                  <th className="py-3 px-3 text-right">Tổng theo giá bán</th>
                  <th className="py-3 px-3">Người lập (Vai trò)</th>
                  <th className="py-3 px-3">Người kiểm (chiếc)</th>
                  <th className="py-3 px-3">Người hoàn thành (Vai trò)</th>
                  <th className="py-3 px-3">Ngày tạo</th>
                  <th className="py-3 px-2 w-28 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedImports.map((imp) => {
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
                  const wh = imp.targetWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1";

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
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              wh === "FLOOR_2"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {wh === "FLOOR_2" ? "🏬 Kho Tầng 2" : "🏢 Kho Tầng 1"}
                          </span>
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
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">
                              {imp.createdByName || "-"}
                            </span>
                            <CmsRoleBadge role={imp.createdByRole} compact />
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {(() => {
                            const byName = new Map<string, { qty: number; role?: string }>();
                            items.forEach((it: any) =>
                              (it.scanCounts || []).forEach((s: any) => {
                                const prev = byName.get(s.name) || { qty: 0, role: s.role };
                                byName.set(s.name, {
                                  qty: prev.qty + (Number(s.quantity) || 0),
                                  role: s.role || prev.role,
                                });
                              })
                            );
                            if (byName.size === 0) {
                              const checkerSet = new Map<string, string | undefined>();
                              items.forEach((it: any) => {
                                if (it.checkedByName) {
                                  checkerSet.set(it.checkedByName, it.checkedByRole);
                                }
                              });
                              if (checkerSet.size === 0) return "-";
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {Array.from(checkerSet.entries()).map(([n, r]) => (
                                    <span key={n} className="inline-flex items-center gap-1">
                                      <span className="font-medium text-slate-700">{n}</span>
                                      <CmsRoleBadge role={r} compact />
                                    </span>
                                  ))}
                                </div>
                              );
                            }
                            return (
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from(byName.entries()).map(([n, info]) => (
                                  <span key={n} className="inline-flex items-center gap-1">
                                    <span className="font-medium text-slate-800">
                                      {n} ({info.qty})
                                    </span>
                                    <CmsRoleBadge role={info.role} compact />
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {imp.completedByName ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800">
                                {imp.completedByName}
                              </span>
                              <CmsRoleBadge role={imp.completedByRole} compact />
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {formatDateTime(imp.createdAt)}
                        </td>
                        <td className="py-3 px-2 text-center text-slate-500">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailModalReceipt(imp);
                              }}
                              className="px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] inline-flex items-center gap-1"
                              title="Xem chi tiết phiếu nhập kho"
                            >
                              <Eye className="w-3.5 h-3.5" /> Chi tiết
                            </button>
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
                          <td colSpan={12} className="p-3">
                            <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                              <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                                    Người lập: <strong>{imp.createdByName || "-"}</strong>{" "}
                                    <CmsRoleBadge role={imp.createdByRole} />
                                  </span>
                                  {imp.completedByName && (
                                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                                      · Người hoàn thành: <strong>{imp.completedByName}</strong>{" "}
                                      <CmsRoleBadge role={imp.completedByRole} />
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDetailModalReceipt(imp)}
                                  className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Mở bảng Xem lại chi tiết đầy đủ
                                </button>
                              </div>
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
                                    <th className="py-2 px-2.5">Người kiểm dòng</th>
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
                                        <td className="py-1.5 px-2.5 whitespace-nowrap">
                                          {it.checkedByName ? (
                                            <span className="inline-flex items-center gap-1">
                                              <span>{it.checkedByName}</span>
                                              <CmsRoleBadge role={it.checkedByRole} compact />
                                            </span>
                                          ) : (
                                            <span className="text-slate-400">-</span>
                                          )}
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

          {renderPaginationBar({
            totalItems: filteredImports.length,
            page: safeImpPage,
            totalPages: impTotalPages,
            pageSize: impPageSize,
            onPageChange: setImpPage,
            onPageSizeChange: setImpPageSize,
            itemLabel: "phiếu nhập kho",
          })}
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
                  Tạo Phiếu Xuất Kho Chuyển Tầng (Nhiều sản phẩm trong 1 phiếu PXK)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Bước 1: Chọn <strong>Hướng dời kho</strong> → Hệ thống chỉ hiển thị các sản phẩm đang có tồn tại <strong>Kho đầu dời</strong>. Bước 2: Chọn nhiều sản phẩm cần dời vào phiếu và bấm <strong>Xác nhận Tạo Phiếu Xuất Kho</strong>.
                </p>
              </div>
            </div>

            {/* BƯỚC 1: CHỌN HƯỚNG DỜI KHO */}
            <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4 space-y-2.5">
              <label className="block text-xs font-extrabold uppercase text-indigo-900">
                1. Chọn Hướng Dời Kho (Kho xuất đầu dời → Kho nhận) *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleChangeTransferDirection("F1_TO_F2")}
                  className={`p-3.5 rounded-xl border-2 text-left transition flex items-center justify-between ${
                    transferDirection === "F1_TO_F2"
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-md"
                      : "bg-white text-slate-800 border-slate-200 hover:border-emerald-400"
                  }`}
                >
                  <div>
                    <div className="text-xs font-extrabold uppercase">
                      🏢 Kho Tầng 1 → 🏬 Kho Tầng 2
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        transferDirection === "F1_TO_F2"
                          ? "text-emerald-100"
                          : "text-slate-500"
                      }`}
                    >
                      Kho đầu dời: <strong>Kho Tầng 1</strong> (Chỉ hiện SP có tồn Tầng 1)
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-mono text-xs font-extrabold ${
                      transferDirection === "F1_TO_F2"
                        ? "bg-white text-emerald-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {
                      products.filter((p) => (Number(p.stockFloor1 ?? p.stock) || 0) > 0)
                        .length
                    }{" "}
                    SP
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleChangeTransferDirection("F2_TO_F1")}
                  className={`p-3.5 rounded-xl border-2 text-left transition flex items-center justify-between ${
                    transferDirection === "F2_TO_F1"
                      ? "bg-blue-600 text-white border-blue-700 shadow-md"
                      : "bg-white text-slate-800 border-slate-200 hover:border-blue-400"
                  }`}
                >
                  <div>
                    <div className="text-xs font-extrabold uppercase">
                      🏬 Kho Tầng 2 → 🏢 Kho Tầng 1
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        transferDirection === "F2_TO_F1"
                          ? "text-blue-100"
                          : "text-slate-500"
                      }`}
                    >
                      Kho đầu dời: <strong>Kho Tầng 2</strong> (Chỉ hiện SP có tồn Tầng 2)
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-mono text-xs font-extrabold ${
                      transferDirection === "F2_TO_F1"
                        ? "bg-white text-blue-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {products.filter((p) => (Number(p.stockFloor2) || 0) > 0).length} SP
                  </span>
                </button>
              </div>
            </div>

            {/* BƯỚC 2: CHỌN SẢN PHẨM TỪ KHO ĐẦU DỜI ĐỂ THÊM VÀO PHIẾU */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-extrabold uppercase text-slate-800">
                  2. Chọn sản phẩm cần dời từ{" "}
                  <span className="text-indigo-700">
                    {transferDirection === "F1_TO_F2" ? "🏢 Kho Tầng 1" : "🏬 Kho Tầng 2"}
                  </span>{" "}
                  ({sourceFloorProducts.length} sản phẩm đang có hàng)
                </label>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={transferSearch}
                    onChange={(e) => setTransferSearch(e.target.value)}
                    placeholder="Tìm tên hoặc mã SP ở kho đầu dời..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              {/* Thanh chọn từ dropdown + số lượng + nút Thêm */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="md:col-span-7">
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Sản phẩm có tại {transferDirection === "F1_TO_F2" ? "Kho Tầng 1" : "Kho Tầng 2"}
                  </label>
                  <select
                    value={transferProductId || sourceFloorProducts[0]?._id || ""}
                    onChange={(e) => setTransferProductId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
                  >
                    {sourceFloorProducts.length === 0 ? (
                      <option value="">
                        -- Không có sản phẩm nào còn tồn ở kho đầu dời này --
                      </option>
                    ) : (
                      sourceFloorProducts.map((p) => {
                        const avail = getSourceFloorStock(p);
                        return (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.code}) — Tồn{" "}
                            {transferDirection === "F1_TO_F2" ? "Kho Tầng 1" : "Kho Tầng 2"}:{" "}
                            {avail} {p.unit}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Số lượng thêm
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={transferQty}
                    onChange={(e) =>
                      setTransferQty(Math.max(1, Math.round(Number(e.target.value) || 1)))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm font-extrabold text-right bg-white"
                  />
                </div>

                <div className="md:col-span-3">
                  <button
                    type="button"
                    disabled={sourceFloorProducts.length === 0}
                    onClick={() =>
                      handleAddTransferItem(
                        transferProductId || sourceFloorProducts[0]?._id,
                        transferQty
                      )
                    }
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm vào phiếu dời kho
                  </button>
                </div>
              </div>

              {/* Danh sách gợi ý bấm chọn nhanh các SP ở Kho đầu dời */}
              {sourceFloorProducts.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="text-[11px] font-bold text-slate-500 mb-2">
                    Bấm nhanh vào sản phẩm bên dưới để đưa vào phiếu dời kho:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {sourceFloorProducts.map((p) => {
                      const avail = getSourceFloorStock(p);
                      const inCart = transferItems.find((i) => i.productId === p._id);
                      return (
                        <button
                          key={p._id}
                          type="button"
                          onClick={() => handleAddTransferItem(p._id, 1)}
                          className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between gap-2 text-xs ${
                            inCart
                              ? "border-indigo-500 bg-indigo-50/70"
                              : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{p.name}</div>
                            <div className="font-mono text-[10px] text-slate-500 truncate">
                              {p.code}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px]">
                              Tồn: {avail} {p.unit}
                            </span>
                            {inCart && (
                              <div className="text-[10px] font-extrabold text-indigo-700 mt-0.5">
                                Đã chọn: {inCart.quantity}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* BƯỚC 3: BẢNG CÁC SẢN PHẨM TRONG PHIẾU DỜI KHO & XÁC NHẬN */}
            <form onSubmit={handleCreateTransfer} className="space-y-4 pt-2 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-extrabold uppercase text-indigo-900">
                  3. Danh sách sản phẩm trong Phiếu Dời Kho ({transferItems.length} mặt hàng · Tổng SL:{" "}
                  {transferItems.reduce((s, i) => s + i.quantity, 0)})
                </label>
                {transferItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTransferItems([])}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    Xóa toàn bộ danh sách chọn
                  </button>
                )}
              </div>

              {transferItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                  Chưa có sản phẩm nào trong phiếu. Hãy bấm chọn các sản phẩm từ{" "}
                  <strong>
                    {transferDirection === "F1_TO_F2" ? "Kho Tầng 1" : "Kho Tầng 2"}
                  </strong>{" "}
                  ở trên để thêm vào phiếu dời kho.
                </div>
              ) : (
                <div className="overflow-x-auto border border-indigo-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-indigo-950 text-white uppercase">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">STT</th>
                        <th className="py-2.5 px-3">Mã hàng</th>
                        <th className="py-2.5 px-3">Tên sản phẩm</th>
                        <th className="py-2.5 px-3 text-center">ĐVT</th>
                        <th className="py-2.5 px-3 text-right">
                          Tồn tại {transferDirection === "F1_TO_F2" ? "Kho Tầng 1" : "Kho Tầng 2"}
                        </th>
                        <th className="py-2.5 px-3 text-right w-36">Số lượng cần dời *</th>
                        <th className="py-2.5 px-3 text-center w-16">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {transferItems.map((item, idx) => {
                        const prod = products.find((p) => p._id === item.productId);
                        if (!prod) return null;
                        const maxAvail = getSourceFloorStock(prod);
                        return (
                          <tr key={item.productId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                              {prod.code}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {prod.name}
                            </td>
                            <td className="py-2.5 px-3 text-center">{prod.unit}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                              {maxAvail}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                min={1}
                                max={maxAvail}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateTransferItemQty(
                                    item.productId,
                                    Number(e.target.value)
                                  )
                                }
                                className="w-24 px-2.5 py-1.5 rounded-lg border-2 border-indigo-400 font-mono font-extrabold text-right text-sm text-indigo-950"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveTransferItem(item.productId)}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                                title="Xóa khỏi phiếu"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-8">
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Ghi chú Phiếu Xuất Kho (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="VD: Dời hàng xuống Kho Tầng 1 để bổ sung quầy bán..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
                <div className="md:col-span-4">
                  <button
                    type="submit"
                    disabled={transferItems.length === 0}
                    className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 transition"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Xác nhận Tạo Phiếu Xuất Kho ({transferItems.length} SP)
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* LỊCH SỬ PHIẾU XUẤT KHO CHUYỂN TẦNG (CÓ XEM CHI TIẾT TỪNG PHIẾU) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Lịch sử Phiếu Xuất Kho Chuyển Tầng (PXK — Bấm vào dòng phiếu để xem chi tiết sản phẩm dời kho)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mỗi phiếu xuất kho chuyển tầng (`PXK-...`) có thể bao gồm 1 hoặc nhiều sản phẩm. Bấm vào một phiếu để mở xem danh sách chi tiết từng mặt hàng đã dời.
              </p>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase">
                  <tr>
                    <th className="py-3 px-3">Mã Phiếu Xuất</th>
                    <th className="py-3 px-3">Thời gian</th>
                    <th className="py-3 px-3">Từ Kho (Đầu dời)</th>
                    <th className="py-3 px-3">Sang Kho (Đích)</th>
                    <th className="py-3 px-3 text-right">Số mặt hàng</th>
                    <th className="py-3 px-3 text-right">Tổng SL dời</th>
                    <th className="py-3 px-3">Người thực hiện</th>
                    <th className="py-3 px-3">Ghi chú</th>
                    <th className="py-3 px-3 text-center">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(() => {
                    // Gom các bản ghi TRANSFER theo referenceCode (PXK-...)
                    const groupedMap = new Map<string, StockMovement[]>();
                    transfersList.forEach((m) => {
                      const code = m.referenceCode || m._id;
                      const list = groupedMap.get(code) || [];
                      list.push(m);
                      groupedMap.set(code, list);
                    });
                    const receiptGroups = Array.from(groupedMap.entries());

                    if (receiptGroups.length === 0) {
                      return (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400">
                            Chưa có phiếu xuất kho chuyển tầng nào.
                          </td>
                        </tr>
                      );
                    }

                    return receiptGroups.map(([refCode, items]) => {
                      const first = items[0];
                      const totalQty = items.reduce(
                        (s, it) => s + Math.abs(Number(it.quantityChange) || 0),
                        0
                      );
                      const isExpanded = expandedTransferCode === refCode;

                      return (
                        <React.Fragment key={refCode}>
                          <tr
                            onClick={() =>
                              setExpandedTransferCode(isExpanded ? null : refCode)
                            }
                            className="hover:bg-indigo-50/40 cursor-pointer transition"
                          >
                            <td className="py-3 px-3 font-mono font-extrabold text-indigo-700">
                              {refCode}
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              {formatDateTime(first.createdAt)}
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                              {first.fromWarehouse === "FLOOR_2"
                                ? "🏬 Kho Tầng 2"
                                : "🏢 Kho Tầng 1"}
                            </td>
                            <td className="py-3 px-3 font-bold text-indigo-700 whitespace-nowrap">
                              {first.toWarehouse === "FLOOR_2"
                                ? "🏬 Kho Tầng 2"
                                : "🏢 Kho Tầng 1"}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold">
                              {items.length} SP
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-extrabold text-indigo-700">
                              {totalQty}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                              {first.performedByName || "Quản trị viên"}
                            </td>
                            <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                              {first.note || "-"}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[11px]">
                                {isExpanded ? (
                                  <>
                                    Ẩn <ChevronUp className="w-3.5 h-3.5" />
                                  </>
                                ) : (
                                  <>
                                    Xem ({items.length}) <ChevronDown className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </span>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-indigo-50/30">
                              <td colSpan={9} className="p-3.5">
                                <div className="border border-indigo-200 rounded-xl overflow-x-auto bg-white shadow-sm">
                                  <div className="bg-indigo-950 text-white px-3.5 py-2 text-[11px] font-bold flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                      Chi tiết Phiếu Xuất Kho Chuyển Tầng: {refCode} (
                                      {first.fromWarehouse === "FLOOR_2"
                                        ? "Kho Tầng 2 → Kho Tầng 1"
                                        : "Kho Tầng 1 → Kho Tầng 2"}
                                      )
                                    </span>
                                    <span>
                                      Người thực hiện: {first.performedByName || "Quản trị viên"} ·{" "}
                                      {formatDateTime(first.createdAt)}
                                    </span>
                                  </div>
                                  <table className="w-full text-[11px] text-left">
                                    <thead className="bg-slate-100 text-slate-800 uppercase border-b border-slate-200">
                                      <tr>
                                        <th className="py-2 px-3 text-center w-12">STT</th>
                                        <th className="py-2 px-3">Mã hàng</th>
                                        <th className="py-2 px-3">Tên sản phẩm</th>
                                        <th className="py-2 px-3 text-center">ĐVT</th>
                                        <th className="py-2 px-3">Từ Kho</th>
                                        <th className="py-2 px-3">Sang Kho</th>
                                        <th className="py-2 px-3 text-right">Số lượng dời</th>
                                        <th className="py-2 px-3">Ghi chú</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                      {items.map((it, idx) => {
                                        const prod = productByCode.get(it.productCode);
                                        return (
                                          <tr key={it._id || idx} className="hover:bg-slate-50">
                                            <td className="py-2 px-3 text-center font-mono">
                                              {idx + 1}
                                            </td>
                                            <td className="py-2 px-3 font-mono font-bold text-slate-800">
                                              {it.productCode}
                                            </td>
                                            <td className="py-2 px-3 font-semibold text-slate-900">
                                              {it.productName}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {(it as any).unit || prod?.unit || "Cái"}
                                            </td>
                                            <td className="py-2 px-3 font-semibold text-slate-700">
                                              {it.fromWarehouse === "FLOOR_2"
                                                ? "🏬 Kho Tầng 2"
                                                : "🏢 Kho Tầng 1"}
                                            </td>
                                            <td className="py-2 px-3 font-semibold text-indigo-700">
                                              {it.toWarehouse === "FLOOR_2"
                                                ? "🏬 Kho Tầng 2"
                                                : "🏢 Kho Tầng 1"}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-extrabold text-indigo-700">
                                              {Math.abs(Number(it.quantityChange) || 0)}
                                            </td>
                                            <td className="py-2 px-3 text-slate-600">
                                              {it.note || "-"}
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
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM LẠI CHI TIẾT KHI NHẬP HÀNG VÀO KHO */}
      {detailModalReceipt && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setDetailModalReceipt(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-base">
                      Chi Tiết Nhập Hàng Vào Kho:{" "}
                      <span className="font-mono text-emerald-400">
                        {detailModalReceipt.code ||
                          detailModalReceipt.receiptCode ||
                          detailModalReceipt._id}
                      </span>
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        detailModalReceipt.status === "COMPLETED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                          : detailModalReceipt.status === "CHECKING"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                      }`}
                    >
                      {detailModalReceipt.status === "COMPLETED"
                        ? "ĐÃ HOÀN THÀNH"
                        : detailModalReceipt.status === "CHECKING"
                        ? "ĐANG KIỂM HÀNG"
                        : detailModalReceipt.status}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                      {detailModalReceipt.targetWarehouse === "FLOOR_2"
                        ? "🏬 Kho Tầng 2"
                        : "🏢 Kho Tầng 1"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Thời gian tạo: {formatDateTime(detailModalReceipt.createdAt)}
                    {detailModalReceipt.completedAt
                      ? ` · Hoàn thành: ${formatDateTime(detailModalReceipt.completedAt)}`
                      : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalReceipt(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Thông tin Người nhập / Người kiểm / Người hoàn thành */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-1">
                  <div className="text-[11px] font-bold uppercase text-purple-800 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    1. Người lập phiếu / Người nhập
                  </div>
                  <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                    <span>{detailModalReceipt.createdByName || "Quản trị viên"}</span>
                    <CmsRoleBadge role={detailModalReceipt.createdByRole || "ADMIN"} />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Lúc: {formatDateTime(detailModalReceipt.createdAt)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 space-y-1">
                  <div className="text-[11px] font-bold uppercase text-teal-800 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    2. Nhân sự kiểm đếm thực tế
                  </div>
                  <div className="font-bold text-slate-900 flex flex-wrap gap-1.5">
                    {(() => {
                      const items: any[] = detailModalReceipt.items || [];
                      const byName = new Map<string, { qty: number; role?: string }>();
                      items.forEach((it) =>
                        (it.scanCounts || []).forEach((s: any) => {
                          const prev = byName.get(s.name) || { qty: 0, role: s.role };
                          byName.set(s.name, {
                            qty: prev.qty + (Number(s.quantity) || 0),
                            role: s.role || prev.role,
                          });
                        })
                      );
                      if (byName.size > 0) {
                        return Array.from(byName.entries()).map(([n, info]) => (
                          <span
                            key={n}
                            className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-teal-200"
                          >
                            <span>
                              {n} ({info.qty} SP)
                            </span>
                            <CmsRoleBadge role={info.role} compact />
                          </span>
                        ));
                      }
                      const checkers = new Map<string, string | undefined>();
                      items.forEach((it) => {
                        if (it.checkedByName) {
                          checkers.set(it.checkedByName, it.checkedByRole);
                        }
                      });
                      if (checkers.size > 0) {
                        return Array.from(checkers.entries()).map(([n, r]) => (
                          <span
                            key={n}
                            className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-teal-200"
                          >
                            <span>{n}</span>
                            <CmsRoleBadge role={r} compact />
                          </span>
                        ));
                      }
                      return <span className="text-slate-400 italic">Chưa ghi nhận quét mã</span>;
                    })()}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                  <div className="text-[11px] font-bold uppercase text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    3. Người xác nhận hoàn thành
                  </div>
                  {detailModalReceipt.completedByName ? (
                    <>
                      <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                        <span>{detailModalReceipt.completedByName}</span>
                        <CmsRoleBadge role={detailModalReceipt.completedByRole} />
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Lúc: {formatDateTime(detailModalReceipt.completedAt)}
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-400 italic py-1">
                      Phiếu chưa hoàn thành nhập kho
                    </div>
                  )}
                </div>
              </div>

              {detailModalReceipt.note && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                  <strong>Ghi chú phiếu nhập:</strong> {detailModalReceipt.note}
                </div>
              )}

              {/* Bảng chi tiết mặt hàng */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-white uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">STT</th>
                      <th className="py-2.5 px-3">Mã hàng</th>
                      <th className="py-2.5 px-3">Tên sản phẩm</th>
                      <th className="py-2.5 px-3 text-center">ĐVT</th>
                      <th className="py-2.5 px-3 text-right">SL Dự kiến</th>
                      <th className="py-2.5 px-3 text-right">SL Thực nhập</th>
                      <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                      <th className="py-2.5 px-3 text-right">Giá gốc (VND)</th>
                      <th className="py-2.5 px-3 text-right">Thành tiền vốn</th>
                      <th className="py-2.5 px-3">Người kiểm dòng</th>
                      <th className="py-2.5 px-3">Ghi chú dòng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(detailModalReceipt.items || []).map((it: any, idx: number) => {
                      const prod = productByCode.get(it.productCode);
                      const expQty = Number(it.expectedQuantity) || 0;
                      const actQty = Number(it.actualQuantity ?? it.expectedQuantity) || 0;
                      const diff = actQty - expQty;
                      const cost = Number(it.costPrice || prod?.costPrice || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-400">
                            {it.stt || idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            {it.productCode}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {it.productName}
                          </td>
                          <td className="py-2 px-3 text-center">{it.unit || "Cái"}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {expQty}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-700">
                            {actQty}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {diff === 0 ? (
                              <span className="text-emerald-600">Khớp (0)</span>
                            ) : (
                              <span className={diff > 0 ? "text-blue-600" : "text-red-600"}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-amber-800 whitespace-nowrap">
                            {formatVND(cost)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatVND(actQty * cost)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {it.checkedByName ? (
                              <div className="inline-flex items-center gap-1">
                                <span className="font-semibold text-slate-800">
                                  {it.checkedByName}
                                </span>
                                <CmsRoleBadge role={it.checkedByRole} compact />
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {it.discrepancyNote || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right uppercase">
                        Tổng cộng ({(detailModalReceipt.items || []).length} mặt hàng):
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {(detailModalReceipt.items || []).reduce(
                          (s: number, it: any) => s + (Number(it.expectedQuantity) || 0),
                          0
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                        {(detailModalReceipt.items || []).reduce(
                          (s: number, it: any) =>
                            s + (Number(it.actualQuantity ?? it.expectedQuantity) || 0),
                          0
                        )}
                      </td>
                      <td colSpan={2}></td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-800 whitespace-nowrap">
                        {formatVND(
                          (detailModalReceipt.items || []).reduce(
                            (s: number, it: any) =>
                              s +
                              (Number(it.actualQuantity ?? it.expectedQuantity) || 0) *
                                (Number(
                                  it.costPrice ||
                                    productByCode.get(it.productCode)?.costPrice ||
                                    0
                                ) || 0),
                            0
                          )
                        )}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailModalReceipt(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
