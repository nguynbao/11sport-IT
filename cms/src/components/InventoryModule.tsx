"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ExportExcelButton from "./ExportExcelButton";
import BarcodeLabelModal, { BarcodeLabelItem } from "./BarcodeLabelModal";
import {
  cleanBarcodeCode,
  findProductByScannedBarcode,
  isScannedCodeMatch,
  playScannerBeep,
  useHardwareBarcodeScanner,
} from "@/lib/barcodeScanner";
import {
  exportProducts,
  exportInventoryReport,
  exportMovements,
  exportImports,
} from "@/lib/exports";
import {
  Product,
  ProductVariant,
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
  extractVariantFromText,
  useDebounce,
  filterAndRankBySearch,
  formatVariantLabel,
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
  Printer,
  Upload,
  Download,
  CopyPlus,
  CheckSquare,
  ScanBarcode,
} from "lucide-react";

interface AdminImportRow {
  stt: number;
  productCode: string;
  productName: string;
  categoryId: string;
  brand: string;
  color: string;
  size: string;
  unit: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  note: string;
  isConfirmed: boolean;
}

type SubTab = "PRODUCTS" | "REPORT" | "MOVEMENTS" | "IMPORTS" | "ADJUSTMENT" | "TRANSFER";
type ActiveWarehouseTab = "FLOOR_1" | "FLOOR_2" | "ALL";

const COMMON_COLORS = [
  "Đỏ",
  "Đen",
  "Trắng",
  "Xanh Dương",
  "Xanh Đen",
  "Xanh Lá",
  "Vàng",
  "Hồng",
  "Xám",
  "Tím",
  "Cam",
  "Kem",
];

const COMMON_SIZES = [
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "FREESIZE",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
];

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

  // Tạo sản phẩm mới / Nhập kho nhiều dòng & Import File (Popup Nhập kho cho Admin)
  const [showAdminImportModal, setShowAdminImportModal] = useState(false);
  const [adminImportNote, setAdminImportNote] = useState("");
  const [newProdCatId, setNewProdCatId] = useState("");
  const [newProdWarehouse, setNewProdWarehouse] = useState<WarehouseFloor>("FLOOR_1");
  const [adminImportRows, setAdminImportRows] = useState<AdminImportRow[]>([
    {
      stt: 1,
      productCode: "",
      productName: "",
      categoryId: "",
      brand: "",
      color: "",
      size: "",
      unit: "Cái",
      quantity: 1,
      costPrice: 0,
      sellingPrice: 0,
      note: "",
      isConfirmed: false,
    },
  ]);
  const [activeAdminSuggestRowIdx, setActiveAdminSuggestRowIdx] = useState<number | null>(null);
  const [adminSuggestHighlightIdx, setAdminSuggestHighlightIdx] = useState<number>(0);
  const [importingAdminFile, setImportingAdminFile] = useState(false);
  const [submittingAdminImport, setSubmittingAdminImport] = useState(false);
  const [adminFileImportMode, setAdminFileImportMode] = useState<"replace" | "append">("replace");
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  const [allCatalogProducts, setAllCatalogProducts] = useState<Product[]>([]);

  // Quản lý Phân loại (Màu sắc • Size • Tồn kho từng tầng) & In Tem Label
  const [expandedVariantProdId, setExpandedVariantProdId] = useState<string | null>(null);
  const [editingVariants, setEditingVariants] = useState<Record<string, ProductVariant[]>>({});
  const [newVariantInputs, setNewVariantInputs] = useState<
    Record<string, { color: string; size: string; stockFloor1: number; stockFloor2: number }>
  >({});
  const [savingVariantsProdId, setSavingVariantsProdId] = useState<string | null>(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelItems, setLabelItems] = useState<BarcodeLabelItem[]>([]);

  // ===== MÁY QUÉT LABEL — QUÉT KIỂM HÀNG & NHẬP KHO TRÊN CMS =====
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [scannerInput, setScannerInput] = useState("");
  const [scannedCheckCounts, setScannedCheckCounts] = useState<Record<string, number>>({});
  const [lastScannedProdId, setLastScannedProdId] = useState<string | null>(null);
  const [onlyShowScanned, setOnlyShowScanned] = useState(false);
  const [lastScanFeedback, setLastScanFeedback] = useState<{
    type: "success" | "warning" | "error";
    code: string;
    message: string;
    time: string;
  } | null>(null);

  // Lập phiếu điều chỉnh kho
  const [adjProductId, setAdjProductId] = useState("");
  const [adjColor, setAdjColor] = useState("");
  const [adjSize, setAdjSize] = useState("");
  const [adjWarehouse, setAdjWarehouse] = useState<WarehouseFloor>("FLOOR_1");
  const [adjQuantityChange, setAdjQuantityChange] = useState<number>(0);
  const [adjReason, setAdjReason] = useState("");

  // Lập phiếu xuất kho chuyển tầng (Kho Tầng 1 <-> Kho Tầng 2) — hỗ trợ nhiều sản phẩm / phiếu
  const [transfersList, setTransfersList] = useState<StockMovement[]>([]);
  const [transferDirection, setTransferDirection] = useState<"F1_TO_F2" | "F2_TO_F1">("F1_TO_F2");
  const [transferProductId, setTransferProductId] = useState("");
  const [transferColor, setTransferColor] = useState("");
  const [transferSize, setTransferSize] = useState("");
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferSearch, setTransferSearch] = useState("");
  const [transferItems, setTransferItems] = useState<
    { productId: string; color?: string; size?: string; quantity: number }[]
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
        const firstId = cList[0]._id;
        setNewProdCatId((prev) => prev || firstId);
        setAdminImportRows((prev) =>
          prev.map((r) => (r.categoryId ? r : { ...r, categoryId: firstId }))
        );
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
      const varMap: Record<string, ProductVariant[]> = {};
      pList.forEach((p) => {
        nameMap[p._id] = p.name || "";
        catMap[p._id] =
          typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
        unitMap[p._id] = p.unit || "Cái";
        f1Map[p._id] = Number(p.stockFloor1 ?? p.stock ?? 0);
        f2Map[p._id] = Number(p.stockFloor2 ?? 0);
        costMap[p._id] = Number(p.costPrice || 0);
        priceMap[p._id] = Number(p.sellingPrice || 0);
        varMap[p._id] = Array.isArray(p.variants)
          ? p.variants.map((v) => ({
              variantKey: v.variantKey,
              color: v.color || "",
              size: v.size || "",
              stockFloor1: Number(v.stockFloor1 ?? 0),
              stockFloor2: Number(v.stockFloor2 ?? 0),
              stock: Number(v.stock ?? (Number(v.stockFloor1 || 0) + Number(v.stockFloor2 || 0))),
            }))
          : [];
      });
      setEditingNames(nameMap);
      setEditingCats(catMap);
      setEditingUnits(unitMap);
      setEditingFloor1(f1Map);
      setEditingFloor2(f2Map);
      setEditingCosts(costMap);
      setEditingPrices(priceMap);
      setEditingVariants(varMap);

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

  // Gợi ý các sản phẩm đã có trong kho khi gõ tên hàng ở từng dòng trong Popup Nhập kho Admin
  const getAdminRowSuggestions = useCallback(
    (query: string): Product[] => {
      const sourceList = allCatalogProducts.length > 0 ? allCatalogProducts : products;
      const q = (query || "").trim();
      if (!q) return sourceList.slice(0, 8);
      return filterAndRankBySearch(sourceList, q, (p) => [
        p.name,
        p.code,
        p.brand,
        p.categoryName,
      ]).slice(0, 8);
    },
    [allCatalogProducts, products]
  );

  const handleSelectAdminRowSuggestion = (rowIdx: number, prod: Product) => {
    setAdminImportRows((prev) => {
      const next = [...prev];
      const cur = next[rowIdx];
      if (!cur) return prev;
      const catId =
        typeof prod.categoryId === "object"
          ? prod.categoryId?._id || newProdCatId
          : String(prod.categoryId || newProdCatId);
      next[rowIdx] = {
        ...cur,
        productName: prod.name,
        productCode: prod.code || generateProductCode(prod.name),
        brand: prod.brand || cur.brand || "",
        categoryId: catId,
        unit: prod.unit || cur.unit || "Cái",
        costPrice: Number(cur.costPrice) > 0 ? Number(cur.costPrice) : Number(prod.costPrice || 0),
        sellingPrice:
          Number(cur.sellingPrice) > 0 ? Number(cur.sellingPrice) : Number(prod.sellingPrice || 0),
      };
      return next;
    });
    setActiveAdminSuggestRowIdx(null);
  };

  const handleUpdateAdminRow = (index: number, field: keyof AdminImportRow, value: any) => {
    setAdminImportRows((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      const cat = categories.find((c) => c._id === String(item.categoryId || newProdCatId));

      if (field === "productName") {
        const extracted = extractVariantFromText(String(value), {
          categoryCode: cat?.code,
          categoryName: cat?.name,
          brand: item.brand,
          existingCode: item.productCode,
        });
        item.productCode =
          extracted.code ||
          generateProductCode(String(value), {
            categoryCode: cat?.code,
            categoryName: cat?.name,
            brand: item.brand,
            existingCode: item.productCode,
          });
        if (!item.brand && extracted.brand) item.brand = extracted.brand;
        if (!item.color && extracted.color) item.color = extracted.color;
        if (!item.size && extracted.size) item.size = extracted.size;
      }

      if (field === "categoryId") {
        const newCatId = String(value || "");
        item.categoryId = newCatId;
        const newCat = categories.find((c) => c._id === newCatId);
        if (newCat && (item.productName.trim() || item.productCode.trim())) {
          item.productCode = generateProductCode(item.productName || item.productCode, {
            categoryCode: newCat.code,
            categoryName: newCat.name,
            brand: item.brand || "NN",
            existingCode: item.productCode,
          });
        }
      }

      if (field === "brand") {
        item.brand = String(value || "");
        if (item.productName.trim() || item.productCode.trim()) {
          item.productCode = generateProductCode(item.productName || item.productCode, {
            categoryCode: cat?.code,
            categoryName: cat?.name,
            brand: item.brand || "NN",
            existingCode: item.productCode,
          });
        }
      }

      if (field === "productCode") {
        item.productCode = String(value || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
      }

      if (field === "size") {
        item.size = String(value || "").toUpperCase();
      }

      if (field === "quantity") {
        item.quantity = Math.max(0, Math.round(Number(value) || 0));
      }

      next[index] = item;

      // Đồng bộ Giá gốc & Giá bán cho các dòng cùng Mã SP chung
      if ((field === "costPrice" || field === "sellingPrice") && item.productCode) {
        for (let i = 0; i < next.length; i++) {
          if (i !== index && next[i].productCode === item.productCode) {
            next[i] = { ...next[i], [field]: value };
          }
        }
      }

      return next;
    });
  };

  const handleAddAdminRow = () => {
    const initCatId = newProdCatId || categories[0]?._id || "";
    setAdminImportRows((prev) => [
      ...prev,
      {
        stt: prev.length + 1,
        productCode: "",
        productName: "",
        categoryId: prev[prev.length - 1]?.categoryId || initCatId,
        brand: "",
        color: "",
        size: "",
        unit: "Cái",
        quantity: 1,
        costPrice: 0,
        sellingPrice: 0,
        note: "",
        isConfirmed: false,
      },
    ]);
  };

  const handleDuplicateAdminRow = (index: number) => {
    setAdminImportRows((prev) => {
      const source = prev[index];
      if (!source) return prev;
      const cloned: AdminImportRow = {
        ...source,
        size: "",
        isConfirmed: false,
      };
      const next = [...prev.slice(0, index + 1), cloned, ...prev.slice(index + 1)];
      return next.map((r, idx) => ({ ...r, stt: idx + 1 }));
    });
  };

  const handleRemoveAdminRow = (index: number) => {
    setAdminImportRows((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      if (filtered.length === 0) {
        return [
          {
            stt: 1,
            productCode: "",
            productName: "",
            categoryId: newProdCatId || categories[0]?._id || "",
            brand: "",
            color: "",
            size: "",
            unit: "Cái",
            quantity: 1,
            costPrice: 0,
            sellingPrice: 0,
            note: "",
            isConfirmed: false,
          },
        ];
      }
      return filtered.map((r, idx) => ({ ...r, stt: idx + 1 }));
    });
  };

  const handleDownloadAdminSampleCsv = () => {
    const sampleRows = [
      ["Mã SP", "Tên sản phẩm", "Hãng", "Màu sắc", "Size", "ĐVT", "Số lượng", "Giá gốc", "Giá bán", "Ghi chú"],
      ["GASIA221401", "Giày Asia 221401", "Asia", "Trắng Xanh", "41", "Đôi", "10", "180000", "290000", "Lô mới"],
      ["GASIA221401", "Giày Asia 221401", "Asia", "Trắng Xanh", "42", "Đôi", "8", "180000", "290000", "Lô mới"],
      ["AKAMITO150824", "Áo đấu Kamito Pro", "Kamito", "Đỏ", "L", "Cái", "12", "150000", "290000", ""],
      ["GNN309412", "Giày Bata Thượng Đình", "NN", "Trắng", "40", "Đôi", "15", "95000", "160000", "Không hãng (NN)"],
    ];
    const csvContent =
      "\uFEFF" +
      sampleRows
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Mau_Nhap_Kho_11Sport.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAdminImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportingAdminFile(true);
    setStatusMsg(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = String(reader.result || "");
          const commaIdx = res.indexOf(",");
          resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
        };
        reader.onerror = () => reject(new Error("Không thể đọc file đã chọn"));
        reader.readAsDataURL(file);
      });

      const res = await apiRequest<{
        fileType: string;
        items: any[];
        totalRows: number;
        totalQuantity: number;
      }>("/imports/parse-file", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          contentBase64: base64,
          defaultCategoryId: newProdCatId || categories[0]?._id || undefined,
        }),
      });

      const parsedItems = Array.isArray(res.data?.items) ? res.data.items : [];
      if (parsedItems.length === 0) {
        alert(
          `Không tìm thấy dòng sản phẩm hợp lệ trong file "${file.name}". Vui lòng kiểm tra cột Tên sản phẩm / Số lượng hoặc tải File Mẫu.`
        );
        return;
      }

      const defaultCat = categories.find((c) => c._id === String(newProdCatId || categories[0]?._id));
      const mappedRows: AdminImportRow[] = parsedItems.map((it: any, idx: number) => {
        const catId = String(it.categoryId || defaultCat?._id || "");
        const rowCat = categories.find((c) => c._id === catId) || defaultCat;
        return {
          stt: idx + 1,
          productCode:
            it.productCode ||
            generateProductCode(it.productName, {
              categoryCode: rowCat?.code,
              categoryName: rowCat?.name,
              brand: it.brand,
            }),
          productName: it.productName || "",
          categoryId: catId,
          brand: it.brand || "",
          color: it.color || "",
          size: String(it.size || "").toUpperCase(),
          unit: it.unit || "Cái",
          quantity: Math.max(1, Number(it.actualQuantity ?? it.expectedQuantity ?? 1)),
          costPrice: Number(it.costPrice || 0),
          sellingPrice: Number(it.sellingPrice || 0),
          note: it.note || "",
          isConfirmed: false,
        };
      });

      setAdminImportRows((prev) => {
        const existingValid = prev.filter((r) => r.productName.trim() !== "");
        const combined =
          adminFileImportMode === "append" && existingValid.length > 0
            ? [...existingValid, ...mappedRows]
            : mappedRows;
        return combined.map((r, idx) => ({ ...r, stt: idx + 1 }));
      });

      if (!adminImportNote.trim()) {
        setAdminImportNote(`Admin nhập kho từ file ${file.name}`);
      }
    } catch (err: any) {
      alert(err?.message || `Lỗi khi đọc file "${file.name}".`);
    } finally {
      setImportingAdminFile(false);
    }
  };

  const handleSubmitAdminBatchImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const validRows = adminImportRows.filter((r) => r.productName.trim() !== "");
    if (validRows.length === 0) {
      alert("Vui lòng nhập hoặc import ít nhất 1 dòng sản phẩm!");
      return;
    }

    const confirmedRows = validRows.filter((r) => r.isConfirmed);
    if (confirmedRows.length === 0) {
      alert(
        "Vui lòng tick xác nhận các dòng cần nhập (hoặc bấm 'Tick xác nhận tất cả') trước khi Hoàn thành Nhập Kho!"
      );
      return;
    }

    setSubmittingAdminImport(true);
    const floorText = newProdWarehouse === "FLOOR_2" ? "Kho Tầng 2" : "Kho Tầng 1";
    try {
      const payloadItems = validRows.map((r, idx) => {
        const cat = categories.find((c) => c._id === String(r.categoryId || newProdCatId));
        return {
          stt: idx + 1,
          productCode:
            r.productCode ||
            generateProductCode(r.productName, {
              categoryCode: cat?.code,
              categoryName: cat?.name,
              brand: r.brand,
            }),
          productName: r.productName.trim(),
          brand: r.brand.trim(),
          color: r.color.trim(),
          size: r.size.trim().toUpperCase(),
          categoryId: r.categoryId || newProdCatId || categories[0]?._id,
          unit: r.unit.trim() || "Cái",
          expectedQuantity: Math.max(1, Number(r.quantity || 1)),
          actualQuantity: Math.max(1, Number(r.quantity || 1)),
          costPrice: Math.max(0, Number(r.costPrice || 0)),
          sellingPrice: Math.max(0, Number(r.sellingPrice || 0)),
          note: r.note.trim(),
          isChecked: true,
          isConfirmed: r.isConfirmed,
          discrepancyNote: "Khớp đủ",
        };
      });

      const createdRes = await apiRequest<any>("/imports", {
        method: "POST",
        body: JSON.stringify({
          note: adminImportNote.trim() || `Admin nhập kho (${confirmedRows.length} dòng)`,
          defaultCategoryId: newProdCatId || categories[0]?._id || undefined,
          targetWarehouse: newProdWarehouse,
          items: payloadItems,
        }),
      });

      const savedReceipt = createdRes.data;
      await apiRequest<any>(`/imports/${savedReceipt._id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          defaultCategoryId: newProdCatId || categories[0]?._id || undefined,
          targetWarehouse: newProdWarehouse,
          items: savedReceipt.items || payloadItems,
        }),
      });

      const totalUnits = confirmedRows.reduce((s, r) => s + Math.max(1, Number(r.quantity || 1)), 0);
      setStatusMsg({
        type: "success",
        text: `Đã hoàn thành nhập kho ${confirmedRows.length} dòng (${totalUnits} sản phẩm) vào ${floorText} thành công!`,
      });

      setAdminImportNote("");
      setAdminImportRows([
        {
          stt: 1,
          productCode: "",
          productName: "",
          categoryId: newProdCatId || categories[0]?._id || "",
          brand: "",
          color: "",
          size: "",
          unit: "Cái",
          quantity: 1,
          costPrice: 0,
          sellingPrice: 0,
          note: "",
          isConfirmed: false,
        },
      ]);
      setShowAdminImportModal(false);
      await loadProductsAndCats();
      loadCategoriesAndImports();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể nhập sản phẩm vào kho.",
      });
    } finally {
      setSubmittingAdminImport(false);
    }
  };

  // Lưu danh sách phân loại (Size • Màu sắc • Tồn Tầng 1/2) của 1 sản phẩm
  const handleSaveProductVariants = async (prod: Product, nextVars?: ProductVariant[]) => {
    const varsToSave = nextVars ?? editingVariants[prod._id] ?? [];
    setSavingVariantsProdId(prod._id);
    setStatusMsg(null);
    try {
      await apiRequest(`/products/${prod._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          variants: varsToSave.map((v) => ({
            color: String(v.color || "").trim(),
            size: String(v.size || "").trim().toUpperCase(),
            stockFloor1: Math.max(0, Math.round(Number(v.stockFloor1 || 0))),
            stockFloor2: Math.max(0, Math.round(Number(v.stockFloor2 || 0))),
          })),
          allowDirectStock: true,
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã cập nhật phân loại Màu sắc / Size & Số lượng tồn kho cho mã "${prod.code}"!`,
      });
      await loadProductsAndCats();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể lưu phân loại Size/Màu.",
      });
    } finally {
      setSavingVariantsProdId(null);
    }
  };

  const handleAddVariantToProduct = async (prod: Product) => {
    const draft = newVariantInputs[prod._id] || {
      color: "",
      size: "",
      stockFloor1: activeWarehouse === "FLOOR_2" ? 0 : 1,
      stockFloor2: activeWarehouse === "FLOOR_2" ? 1 : 0,
    };
    const color = draft.color.trim();
    const size = draft.size.trim().toUpperCase();
    if (!color && !size) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng nhập Màu sắc hoặc Size để thêm phân loại mới.",
      });
      return;
    }
    const f1 = Math.max(0, Math.round(Number(draft.stockFloor1 || 0)));
    const f2 = Math.max(0, Math.round(Number(draft.stockFloor2 || 0)));
    const current = [...(editingVariants[prod._id] || [])];
    const existingIdx = current.findIndex(
      (v) =>
        String(v.color || "").trim().toLowerCase() === color.toLowerCase() &&
        String(v.size || "").trim().toUpperCase() === size
    );
    if (existingIdx >= 0) {
      current[existingIdx] = {
        ...current[existingIdx],
        stockFloor1: (Number(current[existingIdx].stockFloor1) || 0) + f1,
        stockFloor2: (Number(current[existingIdx].stockFloor2) || 0) + f2,
        stock:
          (Number(current[existingIdx].stockFloor1) || 0) +
          f1 +
          (Number(current[existingIdx].stockFloor2) || 0) +
          f2,
      };
    } else {
      current.push({
        color,
        size,
        stockFloor1: f1,
        stockFloor2: f2,
        stock: f1 + f2,
      });
    }
    setEditingVariants((prev) => ({ ...prev, [prod._id]: current }));
    setNewVariantInputs((prev) => ({
      ...prev,
      [prod._id]: { color: "", size: "", stockFloor1: 1, stockFloor2: 0 },
    }));
    await handleSaveProductVariants(prod, current);
  };

  // Mở modal in tem mã vạch (chỉ in đúng mã sản phẩm chung p.code, không kèm màu/size)
  const handleOpenPrintLabelForProduct = (prod: Product) => {
    const qty = Math.max(1, getActiveQty(prod) || 1);
    setLabelItems([
      {
        productCode: prod.code,
        productName: prod.name,
        sellingPrice: Number(editingPrices[prod._id] ?? prod.sellingPrice ?? 0),
        defaultQty: qty,
      },
    ]);
    setShowLabelModal(true);
  };

  const handleOpenPrintLabelsForDisplayed = () => {
    const list: BarcodeLabelItem[] = displayedProducts.slice(0, 50).map((prod) => ({
      productCode: prod.code,
      productName: prod.name,
      sellingPrice: Number(editingPrices[prod._id] ?? prod.sellingPrice ?? 0),
      defaultQty: Math.max(1, getActiveQty(prod) || 1),
    }));
    setLabelItems(list);
    setShowLabelModal(true);
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
          color: adjColor.trim(),
          size: adjSize.trim().toUpperCase(),
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
      if (onlyShowScanned && !scannedCheckCounts[p._id]) {
        return false;
      }
      const f1 = Number(p.stockFloor1 ?? p.stock ?? 0);
      const f2 = Number(p.stockFloor2 ?? 0);
      if (activeWarehouse === "FLOOR_1") {
        if (showZeroFloorItems || scannedCheckCounts[p._id]) return true;
        return f1 > 0 || floor1ImportedCodes.has(p.code) || !floor2ImportedCodes.has(p.code);
      }
      if (activeWarehouse === "FLOOR_2") {
        if (showZeroFloorItems || scannedCheckCounts[p._id]) return true;
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
  }, [products, activeWarehouse, showZeroFloorItems, importsList, search, onlyShowScanned, scannedCheckCounts]);

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

  const handleBarcodeScanInCms = useCallback(
    (rawInput: string) => {
      const rawTrimmed = String(rawInput || "").trim();
      if (!rawTrimmed) return;
      const nowStr = new Date().toLocaleTimeString("vi-VN");
      const pool = allCatalogProducts.length > 0 ? allCatalogProducts : products;

      // Nếu đang mở Popup Nhập Kho Admin -> Quét mã để cộng SL hoặc thêm dòng vào bảng nhập kho
      if (showAdminImportModal) {
        const matchedRowIdx = adminImportRows.findIndex(
          (r) => r.productCode && isScannedCodeMatch(rawTrimmed, r.productCode)
        );
        if (matchedRowIdx >= 0) {
          setAdminImportRows((prev) =>
            prev.map((r, i) =>
              i === matchedRowIdx
                ? { ...r, quantity: (Number(r.quantity) || 0) + 1, isConfirmed: true }
                : r
            )
          );
          const row = adminImportRows[matchedRowIdx];
          playScannerBeep("success");
          setLastScanFeedback({
            type: "success",
            code: row.productCode,
            message: `Đã cộng +1 vào dòng #${matchedRowIdx + 1} [${row.productCode}] ${row.productName} (SL: ${(Number(row.quantity) || 0) + 1})`,
            time: nowStr,
          });
          return;
        }

        const product = findProductByScannedBarcode(pool, rawTrimmed);
        if (product) {
          const catId =
            typeof product.categoryId === "object"
              ? product.categoryId?._id || ""
              : String(product.categoryId || "");
          setAdminImportRows((prev) => {
            const isSingleBlank =
              prev.length === 1 && !prev[0].productCode.trim() && !prev[0].productName.trim();
            const newRow: AdminImportRow = {
              stt: isSingleBlank ? 1 : prev.length + 1,
              productCode: product.code,
              productName: product.name,
              categoryId: catId || newProdCatId || categories[0]?._id || "",
              brand: product.brand || "",
              color: "",
              size: "",
              unit: product.unit || "Cái",
              quantity: 1,
              costPrice: Number(product.costPrice || 0),
              sellingPrice: Number(product.sellingPrice || 0),
              note: "Quét từ máy quét label",
              isConfirmed: true,
            };
            return isSingleBlank ? [newRow] : [...prev, newRow];
          });
          playScannerBeep("success");
          setLastScanFeedback({
            type: "success",
            code: product.code,
            message: `Đã thêm [${product.code}] ${product.name} vào bảng nhập kho (SL: 1)`,
            time: nowStr,
          });
          return;
        }

        playScannerBeep("error");
        setLastScanFeedback({
          type: "error",
          code: cleanBarcodeCode(rawTrimmed),
          message: `Không tìm thấy mã "${rawTrimmed}" trong danh mục để thêm tự động.`,
          time: nowStr,
        });
        return;
      }

      // Mặc định: Quét kiểm hàng & đối chiếu tồn kho trên tab PRODUCTS
      const product = findProductByScannedBarcode(pool, rawTrimmed);
      if (!product) {
        playScannerBeep("error");
        setLastScanFeedback({
          type: "error",
          code: cleanBarcodeCode(rawTrimmed),
          message: `Không tìm thấy sản phẩm có mã "${rawTrimmed}" trong kho.`,
          time: nowStr,
        });
        return;
      }

      setLastScannedProdId(product._id);
      setExpandedVariantProdId(product._id);
      const prevCount = scannedCheckCounts[product._id] || 0;
      const nextCount = prevCount + 1;
      setScannedCheckCounts((prev) => ({
        ...prev,
        [product._id]: nextCount,
      }));

      // Tự động chuyển tới trang có sản phẩm vừa quét nếu đang phân trang
      const idxInDisplayed = displayedProducts.findIndex((p) => p._id === product._id);
      if (idxInDisplayed >= 0 && prodPageSize > 0) {
        const targetPage = Math.floor(idxInDisplayed / prodPageSize) + 1;
        setProdPage(targetPage);
      }

      const f1 = Number(product.stockFloor1 ?? product.stock ?? 0);
      const f2 = Number(product.stockFloor2 ?? 0);
      const sysStock =
        activeWarehouse === "FLOOR_1" ? f1 : activeWarehouse === "FLOOR_2" ? f2 : f1 + f2;
      const isOver = sysStock > 0 && nextCount > sysStock;
      const isExact = sysStock > 0 && nextCount === sysStock;
      playScannerBeep(isOver ? "warning" : "success");

      setLastScanFeedback({
        type: isOver ? "warning" : "success",
        code: product.code,
        message: `[${product.code}] ${product.name} • Đã quét kiểm: ${nextCount} / Tồn ${activeWarehouseLabel}: ${sysStock} ${product.unit || "Cái"}${
          isExact ? " (✓ ĐÃ KHỚP ĐỦ)" : isOver ? ` (⚠️ DƯ +${nextCount - sysStock})` : ""
        }`,
        time: nowStr,
      });
    },
    [
      allCatalogProducts,
      products,
      showAdminImportModal,
      adminImportRows,
      newProdCatId,
      categories,
      scannedCheckCounts,
      displayedProducts,
      prodPageSize,
      activeWarehouse,
      activeWarehouseLabel,
    ]
  );

  useHardwareBarcodeScanner({
    enabled: scannerEnabled && !showLabelModal && (subTab === "PRODUCTS" || showAdminImportModal),
    onScan: (code) => {
      handleBarcodeScanInCms(code);
    },
  });

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
                <button
                  type="button"
                  onClick={() => setShowAdminImportModal(true)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  title="Mở cửa sổ Nhập kho nhanh dành cho Admin"
                >
                  <Plus className="w-4 h-4" />
                  Nhập kho
                </button>
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
                <button
                  type="button"
                  disabled={displayedProducts.length === 0}
                  onClick={handleOpenPrintLabelsForDisplayed}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition"
                  title="In tem nhãn mã vạch (chỉ in mã sản phẩm chung HOALIỀN)"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Tem Label
                </button>
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

            {/* THANH MÁY QUÉT LABEL — QUÉT KIỂM HÀNG & ĐỐI CHIẾU TỒN KHO TRÊN CMS */}
            <div className="rounded-xl border-2 border-emerald-500/80 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/70 p-3 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ScanBarcode className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                        Máy Quét Label — Quét Kiểm Hàng &amp; Đối Chiếu Tồn Kho (CMS)
                      </span>
                      <button
                        type="button"
                        onClick={() => setScannerEnabled((v) => !v)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition ${
                          scannerEnabled
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {scannerEnabled ? "● ĐANG BẬT MÁY QUÉT (TỰ ĐỘNG)" : "○ ĐÃ TẮT MÁY QUÉT"}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Bắn trực tiếp mã vạch để <b>đếm số lượng thực tế (+1 mỗi lần quét)</b>, tự động chuyển trang &amp; bung phân loại Màu/Size (tự động khử lỗi bộ gõ Tiếng Việt Unikey).
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!scannerInput.trim()) return;
                      handleBarcodeScanInCms(scannerInput);
                      setScannerInput("");
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      data-barcode-input="true"
                      value={scannerInput}
                      onChange={(e) => setScannerInput(e.target.value.toUpperCase())}
                      placeholder="Quét hoặc gõ mã SP + Enter..."
                      className="w-48 sm:w-56 px-3 py-1.5 rounded-lg border-2 border-emerald-400 bg-white text-xs font-mono font-extrabold text-slate-900 uppercase focus:border-emerald-600 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold whitespace-nowrap"
                    >
                      +1 Kiểm
                    </button>
                  </form>

                  {Object.keys(scannedCheckCounts).length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setOnlyShowScanned((v) => !v)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-extrabold transition ${
                          onlyShowScanned
                            ? "bg-emerald-700 text-white border-emerald-700"
                            : "bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                        }`}
                      >
                        {onlyShowScanned
                          ? `Đang lọc mã đã quét (${Object.keys(scannedCheckCounts).length})`
                          : `Chỉ hiện mã đã quét (${Object.keys(scannedCheckCounts).length})`}
                      </button>
                      {lastScannedProdId && (scannedCheckCounts[lastScannedProdId] || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setScannedCheckCounts((prev) => {
                              const cur = prev[lastScannedProdId] || 0;
                              const copy = { ...prev };
                              if (cur <= 1) delete copy[lastScannedProdId];
                              else copy[lastScannedProdId] = cur - 1;
                              return copy;
                            });
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác -1
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setScannedCheckCounts({});
                          setLastScannedProdId(null);
                          setOnlyShowScanned(false);
                          setLastScanFeedback(null);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold"
                      >
                        Reset bộ đếm
                      </button>
                    </>
                  )}
                </div>
              </div>

              {lastScanFeedback && (
                <div
                  className={`mt-2.5 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 border ${
                    lastScanFeedback.type === "success"
                      ? "bg-emerald-100/90 border-emerald-300 text-emerald-950"
                      : lastScanFeedback.type === "warning"
                        ? "bg-amber-100/90 border-amber-300 text-amber-950"
                        : "bg-red-100/90 border-red-300 text-red-900"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {lastScanFeedback.type === "error" ? (
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    )}
                    <span className="truncate">{lastScanFeedback.message}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-75 shrink-0">
                    {lastScanFeedback.time}
                  </span>
                </div>
              )}
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
                    const prodVariants = editingVariants[p._id] ?? p.variants ?? [];
                    const namedVars = prodVariants.filter((v) => v.color || v.size);
                    const isVarExpanded = expandedVariantProdId === p._id;
                    const newVarDraft = newVariantInputs[p._id] || {
                      color: "",
                      size: "",
                      stockFloor1: activeWarehouse === "FLOOR_2" ? 0 : 1,
                      stockFloor2: activeWarehouse === "FLOOR_2" ? 1 : 0,
                    };
                    const scannedQty = scannedCheckCounts[p._id] || 0;
                    return (
                      <React.Fragment key={p._id}>
                      <tr
                        className={`hover:bg-slate-50 transition-colors ${
                          lastScannedProdId === p._id
                            ? "bg-emerald-100/80 ring-2 ring-inset ring-emerald-500"
                            : scannedQty > 0
                              ? "bg-emerald-50/40"
                              : ""
                        }`}
                      >
                        <td className="py-3 px-2 text-center font-mono font-bold text-slate-400 align-top">
                          {rowStt}
                        </td>
                        <td className="py-3 px-2.5 font-mono font-bold text-slate-800 align-top break-all max-w-[180px] text-[11px] leading-snug">
                          <div>{p.code}</div>
                          {scannedQty > 0 && (
                            <span
                              className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold font-mono border ${
                                scannedQty === activeQty
                                  ? "bg-emerald-600 text-white border-emerald-700"
                                  : scannedQty > activeQty
                                    ? "bg-amber-500 text-white border-amber-600"
                                    : "bg-teal-100 text-teal-900 border-teal-300"
                              }`}
                            >
                              Đã quét: {scannedQty}/{activeQty}
                            </span>
                          )}
                          <div>
                            <button
                              type="button"
                              onClick={() => handleOpenPrintLabelForProduct(p)}
                              className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-sans font-bold text-[10px]"
                              title="In tem nhãn mã vạch (chỉ in mã sản phẩm chung)"
                            >
                              <Printer className="w-3 h-3" /> In tem
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-2.5 align-top space-y-1.5">
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
                          <div className="flex flex-wrap items-center gap-1">
                            {namedVars.map((v, vIdx) => (
                              <span
                                key={`${v.color}-${v.size}-${vIdx}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold"
                              >
                                <span>
                                  {v.color || "Mặc định"}
                                  {v.size ? ` • ${v.size}` : ""}
                                </span>
                                <span className="font-mono font-extrabold text-emerald-700">
                                  :{activeWarehouse === "FLOOR_2" ? v.stockFloor2 : activeWarehouse === "FLOOR_1" ? v.stockFloor1 : (v.stockFloor1 || 0) + (v.stockFloor2 || 0)}
                                </span>
                              </span>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedVariantProdId(isVarExpanded ? null : p._id)
                              }
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-extrabold transition ${
                                isVarExpanded
                                  ? "bg-indigo-600 text-white border-indigo-700"
                                  : "bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-300"
                              }`}
                            >
                              <span>
                                🎨 Size/Màu ({namedVars.length}) · +Thêm
                              </span>
                              {isVarExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          </div>
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
                      {isVarExpanded && (
                        <tr className="bg-indigo-50/40">
                          <td colSpan={11} className="p-3.5">
                            <div className="bg-white rounded-xl border-2 border-indigo-200 p-3.5 space-y-3 shadow-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-xs font-extrabold text-indigo-950">
                                    🎨 Quản lý Chi tiết Màu sắc • Size • Số lượng cho Mã chung:{" "}
                                    <span className="font-mono text-indigo-700">{p.code}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Các phân loại dưới đây dùng chung 1 Mã hàng ({p.code}), chung Giá gốc ({formatVND(costVal)}) và Giá bán ({formatVND(sellVal)}).
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={savingVariantsProdId === p._id}
                                  onClick={() => handleSaveProductVariants(p)}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs inline-flex items-center gap-1.5 shadow-xs"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  {savingVariantsProdId === p._id
                                    ? "Đang lưu Size/Màu..."
                                    : "Lưu bảng Size/Màu"}
                                </button>
                              </div>

                              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-800 text-white uppercase text-[10px]">
                                    <tr>
                                      <th className="py-2 px-2.5 w-10 text-center">#</th>
                                      <th className="py-2 px-2.5">Màu sắc</th>
                                      <th className="py-2 px-2.5">Size</th>
                                      <th className="py-2 px-2.5 text-right">🏢 Tồn Kho Tầng 1</th>
                                      <th className="py-2 px-2.5 text-right">🏬 Tồn Kho Tầng 2</th>
                                      <th className="py-2 px-2.5 text-right">Tổng SL</th>
                                      <th className="py-2 px-2.5 text-center w-16">Xóa</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {prodVariants.length === 0 ? (
                                      <tr>
                                        <td colSpan={7} className="py-3 text-center text-slate-400">
                                          Chưa có phân loại Size/Màu. Hãy thêm ở dòng bên dưới.
                                        </td>
                                      </tr>
                                    ) : (
                                      prodVariants.map((v, vIdx) => (
                                        <tr key={vIdx} className="hover:bg-slate-50">
                                          <td className="py-1.5 px-2.5 text-center font-mono text-slate-400">
                                            {vIdx + 1}
                                          </td>
                                          <td className="py-1.5 px-2.5">
                                            <input
                                              type="text"
                                              list="cms-color-suggestions"
                                              value={v.color}
                                              onChange={(e) => {
                                                const next = [...prodVariants];
                                                next[vIdx] = { ...next[vIdx], color: e.target.value };
                                                setEditingVariants((prev) => ({
                                                  ...prev,
                                                  [p._id]: next,
                                                }));
                                              }}
                                              placeholder="VD: Đỏ, Trắng..."
                                              className="w-36 px-2 py-1 rounded border border-slate-300 font-semibold"
                                            />
                                          </td>
                                          <td className="py-1.5 px-2.5">
                                            <input
                                              type="text"
                                              list="cms-size-suggestions"
                                              value={v.size}
                                              onChange={(e) => {
                                                const next = [...prodVariants];
                                                next[vIdx] = {
                                                  ...next[vIdx],
                                                  size: e.target.value.toUpperCase(),
                                                };
                                                setEditingVariants((prev) => ({
                                                  ...prev,
                                                  [p._id]: next,
                                                }));
                                              }}
                                              placeholder="M, L, XL, 42..."
                                              className="w-24 px-2 py-1 rounded border border-slate-300 font-mono font-bold uppercase text-center"
                                            />
                                          </td>
                                          <td className="py-1.5 px-2.5 text-right">
                                            <input
                                              type="number"
                                              min={0}
                                              value={v.stockFloor1}
                                              onChange={(e) => {
                                                const nextF1 = Math.max(
                                                  0,
                                                  Math.round(Number(e.target.value) || 0)
                                                );
                                                const next = [...prodVariants];
                                                next[vIdx] = {
                                                  ...next[vIdx],
                                                  stockFloor1: nextF1,
                                                  stock: nextF1 + (Number(next[vIdx].stockFloor2) || 0),
                                                };
                                                setEditingVariants((prev) => ({
                                                  ...prev,
                                                  [p._id]: next,
                                                }));
                                              }}
                                              className="w-24 px-2 py-1 rounded border border-emerald-300 font-mono font-bold text-right text-emerald-800"
                                            />
                                          </td>
                                          <td className="py-1.5 px-2.5 text-right">
                                            <input
                                              type="number"
                                              min={0}
                                              value={v.stockFloor2}
                                              onChange={(e) => {
                                                const nextF2 = Math.max(
                                                  0,
                                                  Math.round(Number(e.target.value) || 0)
                                                );
                                                const next = [...prodVariants];
                                                next[vIdx] = {
                                                  ...next[vIdx],
                                                  stockFloor2: nextF2,
                                                  stock: (Number(next[vIdx].stockFloor1) || 0) + nextF2,
                                                };
                                                setEditingVariants((prev) => ({
                                                  ...prev,
                                                  [p._id]: next,
                                                }));
                                              }}
                                              className="w-24 px-2 py-1 rounded border border-purple-300 font-mono font-bold text-right text-purple-800"
                                            />
                                          </td>
                                          <td className="py-1.5 px-2.5 text-right font-mono font-extrabold text-slate-900">
                                            {(Number(v.stockFloor1) || 0) + (Number(v.stockFloor2) || 0)}
                                          </td>
                                          <td className="py-1.5 px-2.5 text-center">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const next = prodVariants.filter((_, i) => i !== vIdx);
                                                setEditingVariants((prev) => ({
                                                  ...prev,
                                                  [p._id]: next,
                                                }));
                                              }}
                                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                                              title="Xóa phân loại này"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              {/* Dòng thêm nhanh Size / Màu mới */}
                              <div className="flex flex-wrap items-end gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    + Màu sắc mới
                                  </label>
                                  <input
                                    type="text"
                                    list="cms-color-suggestions"
                                    value={newVarDraft.color}
                                    onChange={(e) =>
                                      setNewVariantInputs((prev) => ({
                                        ...prev,
                                        [p._id]: { ...newVarDraft, color: e.target.value },
                                      }))
                                    }
                                    placeholder="VD: Xanh, Đen..."
                                    className="w-36 px-2.5 py-1.5 rounded border border-slate-300 text-xs bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Size mới
                                  </label>
                                  <input
                                    type="text"
                                    list="cms-size-suggestions"
                                    value={newVarDraft.size}
                                    onChange={(e) =>
                                      setNewVariantInputs((prev) => ({
                                        ...prev,
                                        [p._id]: {
                                          ...newVarDraft,
                                          size: e.target.value.toUpperCase(),
                                        },
                                      }))
                                    }
                                    placeholder="M, L, XL, 42..."
                                    className="w-24 px-2.5 py-1.5 rounded border border-slate-300 text-xs font-mono font-bold uppercase text-center bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-emerald-700 mb-0.5">
                                    SL Kho Tầng 1
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={newVarDraft.stockFloor1}
                                    onChange={(e) =>
                                      setNewVariantInputs((prev) => ({
                                        ...prev,
                                        [p._id]: {
                                          ...newVarDraft,
                                          stockFloor1: Math.max(0, Number(e.target.value) || 0),
                                        },
                                      }))
                                    }
                                    className="w-24 px-2.5 py-1.5 rounded border border-emerald-300 text-xs font-mono font-bold text-right bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-purple-700 mb-0.5">
                                    SL Kho Tầng 2
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={newVarDraft.stockFloor2}
                                    onChange={(e) =>
                                      setNewVariantInputs((prev) => ({
                                        ...prev,
                                        [p._id]: {
                                          ...newVarDraft,
                                          stockFloor2: Math.max(0, Number(e.target.value) || 0),
                                        },
                                      }))
                                    }
                                    className="w-24 px-2.5 py-1.5 rounded border border-purple-300 text-xs font-mono font-bold text-right bg-white"
                                  />
                                </div>
                                <button
                                  type="button"
                                  disabled={savingVariantsProdId === p._id}
                                  onClick={() => handleAddVariantToProduct(p)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Thêm Size/Màu &amp; Lưu
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
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
                onChange={(e) => {
                  setAdjProductId(e.target.value);
                  setAdjColor("");
                  setAdjSize("");
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
              >
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.code}) — Tổng tồn: {p.stock} {p.unit} (T1: {p.stockFloor1 ?? p.stock} · T2: {p.stockFloor2 ?? 0})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-indigo-700 mb-1">
                  Màu sắc (Nếu sản phẩm chia theo Màu)
                </label>
                <input
                  type="text"
                  value={adjColor}
                  onChange={(e) => setAdjColor(e.target.value)}
                  placeholder="VD: Đỏ, Trắng..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-indigo-700 mb-1">
                  Size (Nếu sản phẩm chia theo Size)
                </label>
                <input
                  type="text"
                  value={adjSize}
                  onChange={(e) => setAdjSize(e.target.value.toUpperCase())}
                  placeholder="VD: M, L, XL, 42..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase"
                />
              </div>
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

      {/* MODAL POPUP NHẬP KHO DÀNH CHO ADMIN (HỖ TRỢ NHẬP NHIỀU DÒNG & IMPORT EXCEL / CSV / PDF) */}
      {showAdminImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[1440px] max-h-[94vh] flex flex-col overflow-hidden">
            {/* Header Popup */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Nhập Kho Sản Phẩm — Dành cho Admin (Hỗ trợ Nhập nhiều dòng & Import PDF / Excel)</span>
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Mã SP tự sinh: <strong>Chữ đầu Category + Tên Hãng (hoặc NN) + 6 chữ số</strong> (VD: GASIA221401, GNN527368)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminImportModal(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitAdminBatchImport}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {/* Input file ẩn để đọc .xlsx, .csv, .pdf */}
              <input
                ref={adminFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.pdf,.txt"
                onChange={handleAdminImportFileChange}
                className="hidden"
              />

              {/* Khung Ghi chú & Chọn Kho Tầng 1 / Tầng 2 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-8">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Ghi chú Phiếu nhập kho (Admin)
                  </label>
                  <input
                    type="text"
                    value={adminImportNote}
                    onChange={(e) => setAdminImportNote(e.target.value)}
                    placeholder="VD: Admin nhập lô hàng Giày Asia & Áo Kamito đợt mới..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold uppercase text-emerald-700 mb-1">
                    Nhập vào Kho (Chọn Tầng) *
                  </label>
                  <select
                    value={newProdWarehouse}
                    onChange={(e) =>
                      setNewProdWarehouse(
                        e.target.value === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1"
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border-2 border-emerald-600 text-sm font-bold text-slate-900 bg-emerald-50/40"
                  >
                    <option value="FLOOR_1">🏢 Kho Tầng 1</option>
                    <option value="FLOOR_2">🏬 Kho Tầng 2</option>
                  </select>
                </div>
              </div>

              {/* Thanh công cụ Import File Excel/PDF & Tick xác nhận tất cả */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={importingAdminFile}
                    onClick={() => {
                      setAdminFileImportMode("replace");
                      adminFileInputRef.current?.click();
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>
                      {importingAdminFile
                        ? "Đang đọc file..."
                        : "📄 Import PDF / Excel (.xlsx, .csv, .pdf)"}
                    </span>
                  </button>

                  {adminImportRows.some((r) => r.productName.trim() !== "") && (
                    <button
                      type="button"
                      disabled={importingAdminFile}
                      onClick={() => {
                        setAdminFileImportMode("append");
                        adminFileInputRef.current?.click();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>+ Nối thêm từ file</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadAdminSampleCsv}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-600" />
                    <span>Tải File Excel Mẫu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const valid = adminImportRows.filter((r) => r.productName.trim() !== "");
                      if (valid.length === 0) {
                        alert("Chưa có dòng sản phẩm nào để in tem mã vạch!");
                        return;
                      }
                      setLabelItems(
                        valid.map((it, idx) => ({
                          id: `${it.productCode}_${it.color || ""}_${it.size || ""}_${idx}`,
                          productCode: it.productCode || generateProductCode(it.productName),
                          productName: it.productName,
                          color: it.color,
                          size: it.size,
                          sellingPrice: it.sellingPrice,
                          unit: it.unit,
                          defaultQty: Math.max(1, Number(it.quantity || 1)),
                        }))
                      );
                      setShowLabelModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      🖨️ Xuất Mã Vạch / In Tem Label (
                      {adminImportRows.filter((r) => r.productName.trim() !== "").length} dòng)
                    </span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold">
                    Xác nhận nhập: {adminImportRows.filter((r) => r.isConfirmed).length}/
                    {adminImportRows.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white font-bold">
                    Tổng giá gốc:{" "}
                    {formatVND(
                      adminImportRows.reduce(
                        (s, r) => s + (Number(r.costPrice) || 0) * (Number(r.quantity) || 0),
                        0
                      )
                    )}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-700 text-white font-bold">
                    Tổng giá bán:{" "}
                    {formatVND(
                      adminImportRows.reduce(
                        (s, r) => s + (Number(r.sellingPrice) || 0) * (Number(r.quantity) || 0),
                        0
                      )
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAdminImportRows((prev) =>
                        prev.map((r) => ({ ...r, isConfirmed: true }))
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Tick xác nhận tất cả
                  </button>
                </div>
              </div>

              {/* Bảng nhập nhiều dòng sản phẩm */}
              <div
                className={`overflow-x-auto border border-slate-200 rounded-xl transition-all ${
                  activeAdminSuggestRowIdx !== null ? "pb-60" : ""
                }`}
              >
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-white uppercase">
                    <tr>
                      <th className="py-3 px-2 text-center w-10">STT</th>
                      <th className="py-3 px-2.5 min-w-[155px]">MÃ SP (CATE+HÃNG+6 SỐ)</th>
                      <th className="py-3 px-2.5 min-w-[210px]">TÊN SẢN PHẨM</th>
                      <th className="py-3 px-2 min-w-[130px] text-cyan-300">CATEGORY</th>
                      <th className="py-3 px-2 min-w-[105px] text-cyan-300">HÃNG (NN)</th>
                      <th className="py-3 px-2 min-w-[110px] text-amber-300">MÀU SẮC</th>
                      <th className="py-3 px-2 w-24 min-w-[80px] text-center text-amber-300">
                        SIZE
                      </th>
                      <th className="py-3 px-2 w-20 min-w-[70px] text-center">ĐVT</th>
                      <th className="py-3 px-2 w-24 min-w-[85px] text-right bg-slate-800 text-amber-300">
                        SỐ LƯỢNG
                      </th>
                      <th className="py-3 px-2.5 w-32 min-w-[120px] text-right">GIÁ GỐC (VND)</th>
                      <th className="py-3 px-2.5 w-32 min-w-[120px] text-right text-emerald-300">
                        GIÁ BÁN (VND)
                      </th>
                      <th className="py-3 px-2 min-w-[120px]">GHI CHÚ</th>
                      <th className="py-3 px-2 w-24 text-center bg-slate-800 text-emerald-300">
                        XÁC NHẬN
                      </th>
                      <th className="py-3 px-2 w-16 text-center">THÊM/XÓA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {adminImportRows.map((row, idx) => {
                      const existingProd = row.productCode
                        ? productByCode.get(row.productCode)
                        : undefined;
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50 ${
                            row.isConfirmed ? "bg-emerald-50/20" : ""
                          }`}
                        >
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700 align-top pt-3.5">
                            {idx + 1}
                          </td>

                          {/* MÃ SP */}
                          <td className="py-2.5 px-2.5 align-top">
                            <input
                              type="text"
                              value={row.productCode}
                              onChange={(e) =>
                                handleUpdateAdminRow(idx, "productCode", e.target.value)
                              }
                              placeholder="VD: GASIA221401"
                              className="w-full bg-blue-50/70 text-blue-900 font-mono text-xs font-extrabold px-2.5 py-1.5 rounded border border-blue-300 uppercase focus:border-blue-600 focus:outline-none"
                            />
                            <div className="mt-1 text-[10px] text-slate-500">
                              {existingProd ? (
                                <span className="text-emerald-700 font-bold">
                                  ✓ Đã có mã (Tồn: {existingProd.stock})
                                </span>
                              ) : (
                                <span>Cate + Hãng/NN + 6 số</span>
                              )}
                            </div>
                          </td>

                          {/* TÊN SẢN PHẨM + GỢI Ý */}
                          <td className="py-2.5 px-2.5 align-top">
                            <div className="relative">
                              <input
                                type="text"
                                value={row.productName}
                                onFocus={() => {
                                  setActiveAdminSuggestRowIdx(idx);
                                  setAdminSuggestHighlightIdx(0);
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setActiveAdminSuggestRowIdx((prev) =>
                                      prev === idx ? null : prev
                                    );
                                  }, 180);
                                }}
                                onChange={(e) => {
                                  handleUpdateAdminRow(idx, "productName", e.target.value);
                                  setActiveAdminSuggestRowIdx(idx);
                                  setAdminSuggestHighlightIdx(0);
                                }}
                                onKeyDown={(e) => {
                                  if (activeAdminSuggestRowIdx !== idx) return;
                                  const suggestions = getAdminRowSuggestions(row.productName);
                                  if (suggestions.length === 0) return;
                                  if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    setAdminSuggestHighlightIdx(
                                      (prev) => (prev + 1) % suggestions.length
                                    );
                                  } else if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    setAdminSuggestHighlightIdx(
                                      (prev) =>
                                        (prev - 1 + suggestions.length) % suggestions.length
                                    );
                                  } else if (e.key === "Enter") {
                                    const picked =
                                      suggestions[adminSuggestHighlightIdx] || suggestions[0];
                                    if (picked && picked.name !== row.productName) {
                                      e.preventDefault();
                                      handleSelectAdminRowSuggestion(idx, picked);
                                    }
                                  } else if (e.key === "Escape") {
                                    setActiveAdminSuggestRowIdx(null);
                                  }
                                }}
                                placeholder="Gõ tên hàng (VD: Giày Asia 221401)..."
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                              />

                              {activeAdminSuggestRowIdx === idx &&
                                (() => {
                                  const suggestions = getAdminRowSuggestions(row.productName);
                                  if (suggestions.length === 0) return null;
                                  return (
                                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl border-2 border-emerald-500 shadow-2xl overflow-hidden min-w-[320px] sm:min-w-[380px]">
                                      <div className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold flex items-center justify-between gap-2">
                                        <span>
                                          📦 Gợi ý sản phẩm trong kho ({suggestions.length})
                                        </span>
                                        <span className="text-emerald-300 font-normal">
                                          Bấm chọn để lấy Mã chung & Giá
                                        </span>
                                      </div>
                                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                                        {suggestions.map((p, sIdx) => {
                                          const isHighlighted = sIdx === adminSuggestHighlightIdx;
                                          return (
                                            <button
                                              key={p._id}
                                              type="button"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleSelectAdminRowSuggestion(idx, p);
                                              }}
                                              onMouseEnter={() =>
                                                setAdminSuggestHighlightIdx(sIdx)
                                              }
                                              className={`w-full text-left px-3 py-2 transition flex flex-col gap-0.5 ${
                                                isHighlighted
                                                  ? "bg-emerald-50/90"
                                                  : "hover:bg-slate-50"
                                              }`}
                                            >
                                              <div className="font-bold text-xs text-slate-900">
                                                {p.name}
                                              </div>
                                              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                                                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                                  {p.code}
                                                </span>
                                                <span className="text-emerald-700 font-bold">
                                                  Tổng tồn: {p.stock} {p.unit}
                                                </span>
                                                {Number(p.sellingPrice) > 0 && (
                                                  <span className="font-mono font-bold text-slate-800">
                                                    Bán: {formatVND(p.sellingPrice)}
                                                  </span>
                                                )}
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}
                            </div>
                          </td>

                          {/* CATEGORY */}
                          <td className="py-2.5 px-2 align-top">
                            <select
                              value={String(
                                row.categoryId || newProdCatId || categories[0]?._id || ""
                              )}
                              onChange={(e) => {
                                setNewProdCatId(e.target.value);
                                handleUpdateAdminRow(idx, "categoryId", e.target.value);
                              }}
                              className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
                            >
                              {categories.map((c) => (
                                <option key={c._id} value={c._id}>
                                  {c.name} ({c.code})
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* HÃNG (NN) */}
                          <td className="py-2.5 px-2 align-top">
                            <input
                              type="text"
                              value={row.brand}
                              onChange={(e) =>
                                handleUpdateAdminRow(idx, "brand", e.target.value)
                              }
                              placeholder="NN (Không hãng)"
                              className="w-full px-2 py-1.5 rounded border border-slate-300 font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
                            />
                          </td>

                          {/* MÀU SẮC */}
                          <td className="py-2.5 px-2 align-top">
                            <input
                              type="text"
                              list="cms-color-suggestions"
                              value={row.color}
                              onChange={(e) =>
                                handleUpdateAdminRow(idx, "color", e.target.value)
                              }
                              placeholder="VD: Đỏ, Trắng..."
                              className="w-full px-2 py-1.5 rounded border border-slate-300 font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
                            />
                          </td>

                          {/* SIZE */}
                          <td className="py-2.5 px-2 align-top">
                            <input
                              type="text"
                              list="cms-size-suggestions"
                              value={row.size}
                              onChange={(e) =>
                                handleUpdateAdminRow(idx, "size", e.target.value.toUpperCase())
                              }
                              placeholder="S, M, L, 42..."
                              className="w-full px-2 py-1.5 rounded border border-slate-300 text-center font-mono font-extrabold uppercase text-indigo-800 focus:border-emerald-600 focus:outline-none"
                            />
                          </td>

                          {/* ĐVT */}
                          <td className="py-2.5 px-2 align-top">
                            <input
                              type="text"
                              value={row.unit}
                              onChange={(e) =>
                                handleUpdateAdminRow(idx, "unit", e.target.value)
                              }
                              placeholder="Cái"
                              className="w-full px-2 py-1.5 rounded border border-slate-300 text-center font-medium text-slate-900"
                            />
                          </td>

                          {/* SỐ LƯỢNG */}
                          <td className="py-2.5 px-2 align-top bg-amber-50/30">
                            <input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) =>
                                handleUpdateAdminRow(idx, "quantity", e.target.value)
                              }
                              className="w-full px-2 py-1.5 rounded border-2 border-amber-400 text-right font-mono font-extrabold text-slate-900"
                            />
                          </td>

                          {/* GIÁ GỐC */}
                          <td className="py-2.5 px-2.5 align-top">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.costPrice > 0 ? formatNumberDots(row.costPrice) : ""}
                              onChange={(e) =>
                                handleUpdateAdminRow(
                                  idx,
                                  "costPrice",
                                  parseNumberDots(e.target.value)
                                )
                              }
                              placeholder="0"
                              className="w-full px-2 py-1.5 rounded border border-slate-300 text-right font-mono font-bold text-slate-900"
                            />
                          </td>

                          {/* GIÁ BÁN */}
                          <td className="py-2.5 px-2.5 align-top">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={
                                row.sellingPrice > 0 ? formatNumberDots(row.sellingPrice) : ""
                              }
                              onChange={(e) =>
                                handleUpdateAdminRow(
                                  idx,
                                  "sellingPrice",
                                  parseNumberDots(e.target.value)
                                )
                              }
                              placeholder="0"
                              className="w-full px-2 py-1.5 rounded border border-emerald-300 text-right font-mono font-bold text-emerald-900"
                            />
                          </td>

                          {/* GHI CHÚ */}
                          <td className="py-2.5 px-2 align-top">
                            <input
                              type="text"
                              value={row.note}
                              onChange={(e) =>
                                handleUpdateAdminRow(idx, "note", e.target.value)
                              }
                              placeholder="Ghi chú..."
                              className="w-full px-2 py-1.5 rounded border border-slate-300"
                            />
                          </td>

                          {/* XÁC NHẬN (MẶC ĐỊNH KHÔNG TICK) */}
                          <td className="py-2.5 px-2 text-center bg-emerald-50/30 align-top pt-3">
                            <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={row.isConfirmed}
                                onChange={(e) =>
                                  handleUpdateAdminRow(idx, "isConfirmed", e.target.checked)
                                }
                                className="w-4 h-4 accent-emerald-600 rounded"
                              />
                              <span
                                className={`text-[10px] font-bold ${
                                  row.isConfirmed ? "text-emerald-800" : "text-slate-400"
                                }`}
                              >
                                {row.isConfirmed ? "✓ Nhập" : "Bỏ qua"}
                              </span>
                            </label>
                          </td>

                          {/* THÊM / XÓA DÒNG */}
                          <td className="py-2.5 px-1.5 text-center align-top pt-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDuplicateAdminRow(idx)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title="Thêm nhanh Size / Màu khác cho cùng Mã SP này"
                              >
                                <CopyPlus className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveAdminRow(idx)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                                title="Xóa dòng"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Nút Thêm dòng mới nằm ngay dưới bảng trong phiếu */}
                <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleAddAdminRow}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm dòng mới</span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Bấm <strong>Thêm dòng mới</strong> để thêm mặt hàng hoặc bấm biểu tượng nhân bản ở cuối dòng để thêm Size / Màu cùng Mã SP
                  </span>
                </div>
              </div>

              {/* Footer Popup */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  Mặc định cột <strong>Xác nhận</strong> không tick. Vui lòng tick các dòng cần nhập hoặc bấm{" "}
                  <strong>Tick xác nhận tất cả</strong> trước khi hoàn thành.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminImportModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdminImport}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {submittingAdminImport
                        ? "Đang nhập kho..."
                        : `✅ Hoàn thành Nhập Kho (${
                            adminImportRows.filter(
                              (r) => r.productName.trim() !== "" && r.isConfirmed
                            ).length
                          } dòng đã tick)`}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DATALIST GỢI Ý MÀU SẮC & SIZE CHO CMS (GIỐNG WEB) */}
      <datalist id="cms-color-suggestions">
        {COMMON_COLORS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="cms-size-suggestions">
        {COMMON_SIZES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* MODAL IN TEM NHÃN MÃ VẠCH CODE128 (CHỈ MÃ SẢN PHẨM CHUNG, KHÔNG KÈM MÀU/SIZE) */}
      <BarcodeLabelModal
        open={showLabelModal}
        onClose={() => setShowLabelModal(false)}
        items={labelItems}
        title="In Tem Nhãn Mã Vạch (CMS Quản lý Kho)"
      />
    </div>
  );
}
