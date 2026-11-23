"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ExportExcelButton from "./ExportExcelButton";
import BarcodeLabelModal, { BarcodeLabelItem } from "./BarcodeLabelModal";
import ProductCodeCreatorModal, { ProductCodeCreatorResult } from "./ProductCodeCreatorModal";
import {
  ColorInputWithPicker,
  ColorSwatchBadge,
  getColorBoxBorderStyle,
  resolveVariantColorHexes,
} from "./ColorSwatchPicker";
import {
  cleanBarcodeCode,
  findProductAndVariantByScannedBarcode,
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
  resolveVariantCode,
  findVariantByColorSize,
  variantEffectiveSellingPrice,
  variantEffectiveCostPrice,
  lookupProductByCodeApi,
  fetchBrandsApi,
  Brand,
  describeApiError,
  getStoredUser,
  extractVariantFromText,
  useDebounce,
  filterAndRankBySearch,
  formatVariantLabel,
} from "@/lib/api";
import {
  Package,
  BarChart3,
  BookOpen,
  ClipboardList,
  Save,
  Pencil,
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
  /** v5.0: id sản phẩm có sẵn (chọn từ gợi ý / quét / vừa tạo) — server dùng đúng sản phẩm này */
  productId?: string;
  /** Mã gốc do SERVER sinh (sản phẩm có sẵn). Dòng hàng mới để trống — server tự sinh theo Cate+Brand+Version */
  productCode: string;
  /** Mã con của biến thể đã chọn */
  variantCode?: string;
  /** Cho phép thêm Màu/Size mới cho SP đã chọn */
  isNewVariant?: boolean;
  /** Mã màu 2–3 ký tự (tuỳ chọn, server gợi ý nếu trống) */
  colorCode?: string;
  productName: string;
  categoryId: string;
  brand: string;
  color: string;
  colorHexes?: string[];
  size: string;
  unit: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  note: string;
  isConfirmed: boolean;
}

type SubTab = "PRODUCTS" | "TRANSFER" | "HISTORY" | "REPORT";
type HistoryView = "IMPORTS" | "MOVEMENTS" | "TRANSFERS";
type ActiveWarehouseTab = "FLOOR_1" | "FLOOR_2" | "ALL";
type QuickStockFilter = "ALL" | "IN_STOCK" | "ZERO_STOCK" | "MISSING_PRICE" | "CHANGED";

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
  if (r === "CEO") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
        {compact ? "CEO" : "CEO (Giám đốc)"}
      </span>
    );
  }
  if (r === "ADMIN") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap">
        {compact ? "ADMIN" : "ADMIN (Quản lý)"}
      </span>
    );
  }
  if (r === "ACCOUNTANT") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-100 text-brand-ink border border-teal-200 whitespace-nowrap">
        {compact ? "ACCOUNTANT" : "ACCOUNTANT (Kế toán & Kho)"}
      </span>
    );
  }
  if (r === "SALES") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-100 text-brand-ink border border-teal-200 whitespace-nowrap">
        {compact ? "SALES" : "SALES (Bán hàng)"}
      </span>
    );
  }
  return null;
}

export default function InventoryModule() {
  const [subTab, setSubTab] = useState<SubTab>("PRODUCTS");
  const [historyView, setHistoryView] = useState<HistoryView>("IMPORTS");
  const [activeWarehouse, setActiveWarehouse] = useState<ActiveWarehouseTab>("FLOOR_1");
  const [showZeroFloorItems, setShowZeroFloorItems] = useState(false);
  const [quickStockFilter, setQuickStockFilter] = useState<QuickStockFilter>("ALL");
  const [showScannerPanel, setShowScannerPanel] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [reportRows, setReportRows] = useState<InventoryReportRow[]>([]);
  const [importsList, setImportsList] = useState<any[]>([]);
  const [expandedImportId, setExpandedImportId] = useState<string | null>(null);

  // Filter
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  // v5.0: lọc theo Thương hiệu
  const [brandFilter, setBrandFilter] = useState("");
  const [brandOptions, setBrandOptions] = useState<Brand[]>([]);
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

  // Tên, Ghi chú, Category, ĐVT, Số lượng từng tầng (Tầng 1, Tầng 2), Giá gốc & Giá bán chỉnh sửa theo productId
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
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
  const [importFilterCatId, setImportFilterCatId] = useState<string>("");
  const [importFilterBrandId, setImportFilterBrandId] = useState<string>("");
  const [importingAdminFile, setImportingAdminFile] = useState(false);
  const [submittingAdminImport, setSubmittingAdminImport] = useState(false);
  const submittingImportRef = useRef(false);
  const [adminFileImportMode, setAdminFileImportMode] = useState<"replace" | "append">("replace");
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  const [allCatalogProducts, setAllCatalogProducts] = useState<Product[]>([]);
  // v5.0: Popup tạo / sửa sản phẩm chuẩn mã (Category → Brand → Version → biến thể)
  const [showCodeCreator, setShowCodeCreator] = useState(false);
  const [editingProductModal, setEditingProductModal] = useState<Product | null>(null);
  // R5/AC: role SALES không thấy giá vốn (server cũng không trả costPrice cho SALES)
  const [canSeeCost, setCanSeeCost] = useState(true);
  useEffect(() => {
    setCanSeeCost(String(getStoredUser()?.role || "").toUpperCase() !== "SALES");
  }, []);

  // v5.0: tra sản phẩm theo mã (mã mới + mã cũ) để lấy MÃ CON DO SERVER SINH thay vì tự sinh ở client
  const catalogByCode = useMemo(() => {
    const m = new Map<string, Product>();
    const add = (code: string | undefined, p: Product) => {
      const k = String(code || "").trim().toUpperCase();
      if (k && !m.has(k)) m.set(k, p);
    };
    [...products, ...allCatalogProducts].forEach((p) => {
      add(p.code, p);
      add(p.legacyCode, p);
      (p.legacyCodes || []).forEach((c) => add(c, p));
    });
    return m;
  }, [products, allCatalogProducts]);
  const variantCodeFor = (baseCode?: string, color?: string, size?: string): string =>
    resolveVariantCode(catalogByCode.get(String(baseCode || "").trim().toUpperCase()), baseCode, color, size);

  // Quản lý Phân loại (Màu sắc • Size • Tồn kho từng tầng) & In Tem Label
  const [expandedVariantProdId, setExpandedVariantProdId] = useState<string | null>(null);
  const [cmsVarColorFilter, setCmsVarColorFilter] = useState<string>("ALL");
  const [cmsVarSearch, setCmsVarSearch] = useState<string>("");
  const [editingVariants, setEditingVariants] = useState<Record<string, ProductVariant[]>>({});

  useEffect(() => {
    setCmsVarColorFilter("ALL");
    setCmsVarSearch("");
  }, [expandedVariantProdId]);
  const [newVariantInputs, setNewVariantInputs] = useState<
    Record<
      string,
      {
        color: string;
        colorHexes?: string[];
        size: string;
        stockFloor1: number;
        stockFloor2: number;
      }
    >
  >({});
  const [savingVariantsProdId, setSavingVariantsProdId] = useState<string | null>(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelItems, setLabelItems] = useState<BarcodeLabelItem[]>([]);

  // ===== CẤU HÌNH LIÊN KẾT SẢN PHẨM BỘ ↔ SẢN PHẨM LẺ & TÁCH BỘ 1 CHẠM =====
  const [setLinkModalProduct, setSetLinkModalProduct] = useState<Product | null>(null);
  const [setLinkMode, setSetLinkMode] = useState<"AS_RETAIL" | "AS_SET">("AS_RETAIL");
  const [selectedParentSetId, setSelectedParentSetId] = useState<string>("");
  const [packSizeInput, setPackSizeInput] = useState<number>(12);
  const [setLinkSearch, setSetLinkSearch] = useState<string>("");
  const [setChildMode, setSetChildMode] = useState<"EXISTING_RETAIL" | "CREATE_NEW_RETAIL">(
    "CREATE_NEW_RETAIL"
  );
  const [selectedExistingRetailId, setSelectedExistingRetailId] = useState<string>("");
  const [newRetailName, setNewRetailName] = useState<string>("");
  const [newRetailUnit, setNewRetailUnit] = useState<string>("Cái");
  const [newRetailSellingPrice, setNewRetailSellingPrice] = useState<number>(0);
  const [modalUnpackCount, setModalUnpackCount] = useState<number>(1);
  const [modalUnpackWarehouse, setModalUnpackWarehouse] = useState<WarehouseFloor>("FLOOR_1");
  const [savingSetLink, setSavingSetLink] = useState<boolean>(false);
  const [unpackingLoadingId, setUnpackingLoadingId] = useState<string | null>(null);

  // ===== MÁY QUÉT LABEL — QUÉT KIỂM HÀNG & NHẬP KHO TRÊN CMS =====
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [scannerInput, setScannerInput] = useState("");
  const [scannedCheckCounts, setScannedCheckCounts] = useState<Record<string, number>>({});
  const [scannedVariantCounts, setScannedVariantCounts] = useState<
    Record<string, Record<string, number>>
  >({});
  const [lastScannedProdId, setLastScannedProdId] = useState<string | null>(null);
  const [lastScannedVariantCode, setLastScannedVariantCode] = useState<string | null>(null);
  const [onlyShowScanned, setOnlyShowScanned] = useState(false);
  const [lastScanFeedback, setLastScanFeedback] = useState<{
    type: "success" | "warning" | "error";
    code: string;
    message: string;
    time: string;
  } | null>(null);

  // Lập phiếu xuất kho chuyển tầng (Kho Tầng 1 <-> Kho Tầng 2) — hỗ trợ nhiều sản phẩm / phiếu
  const [transfersList, setTransfersList] = useState<StockMovement[]>([]);
  const [transferDirection, setTransferDirection] = useState<"F1_TO_F2" | "F2_TO_F1">("F1_TO_F2");
  const [transferProductId, setTransferProductId] = useState("");
  const [transferColor, setTransferColor] = useState("");
  const [transferSize, setTransferSize] = useState("");
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferSearch, setTransferSearch] = useState("");
  const [transferSuggestOpen, setTransferSuggestOpen] = useState(false);
  const [transferItems, setTransferItems] = useState<
    { productId: string; color?: string; size?: string; quantity: number }[]
  >([]);
  const [transferNote, setTransferNote] = useState("");
  const [expandedTransferCode, setExpandedTransferCode] = useState<string | null>(null);

  // Trạng thái lưu hàng loạt & xem lại chi tiết nhập hàng
  const [savingBatch, setSavingBatch] = useState(false);
  const [detailModalReceipt, setDetailModalReceipt] = useState<any | null>(null);

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
      fetchBrandsApi()
        .then(setBrandOptions)
        .catch(() => undefined);
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
      if (!categoryId && !debouncedSearch.trim()) {
        setAllCatalogProducts(pList);
      }

      const nameMap: Record<string, string> = {};
      const noteMap: Record<string, string> = {};
      const catMap: Record<string, string> = {};
      const unitMap: Record<string, string> = {};
      const f1Map: Record<string, number> = {};
      const f2Map: Record<string, number> = {};
      const costMap: Record<string, number> = {};
      const priceMap: Record<string, number> = {};
      const varMap: Record<string, ProductVariant[]> = {};
      pList.forEach((p) => {
        nameMap[p._id] = p.name || "";
        noteMap[p._id] = p.note || "";
        catMap[p._id] =
          typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
        unitMap[p._id] = p.unit || "Cái";
        f1Map[p._id] = Number(p.stockFloor1 ?? p.stock ?? 0);
        f2Map[p._id] = Number(p.stockFloor2 ?? 0);
        costMap[p._id] = Number(p.costPrice || 0);
        priceMap[p._id] = Number(p.sellingPrice || 0);
        varMap[p._id] = Array.isArray(p.variants)
          ? p.variants.map((v) => ({
            ...v,
            variantKey: v.variantKey,
            variantCode: v.variantCode,
            barcode: v.barcode,
            color: v.color || "",
            colorHexes: Array.isArray(v.colorHexes) ? v.colorHexes : [],
            size: v.size || "",
            stockFloor1: Number(v.stockFloor1 ?? 0),
            stockFloor2: Number(v.stockFloor2 ?? 0),
            stock: Number(v.stock ?? (Number(v.stockFloor1 || 0) + Number(v.stockFloor2 || 0))),
          }))
          : [];
      });
      setEditingNames(nameMap);
      setEditingNotes(noteMap);
      setEditingCats(catMap);
      setEditingUnits(unitMap);
      setEditingFloor1(f1Map);
      setEditingFloor2(f2Map);
      setEditingCosts(costMap);
      setEditingPrices(priceMap);
      setEditingVariants(varMap);
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
    if (subTab === "HISTORY") {
      if (historyView === "IMPORTS") loadImports();
      if (historyView === "MOVEMENTS") loadMovements();
      if (historyView === "TRANSFERS") loadTransfers();
    }
    if (subTab === "TRANSFER") loadTransfers();
  }, [subTab, historyView, loadReport, loadMovements, loadImports, loadTransfers]);

  const handleSelectWarehouseTab = (wh: ActiveWarehouseTab) => {
    setActiveWarehouse(wh);
    if (wh === "FLOOR_1" || wh === "FLOOR_2") {
      setNewProdWarehouse(wh);
    }
  };

  // Kiểm tra sản phẩm có thay đổi so với giá trị gốc hay không
  const isProductChanged = useCallback(
    (prod: Product) => {
      const origName = String(prod.name ?? "").trim();
      const origNote = String(prod.note ?? "").trim();
      const origCatId = String(
        typeof prod.categoryId === "object" ? prod.categoryId?._id || "" : prod.categoryId || ""
      );
      const origUnit = String(prod.unit ?? "Cái").trim() || "Cái";
      const origF1 = Math.max(0, Math.round(Number(prod.stockFloor1 ?? prod.stock ?? 0)));
      const origF2 = Math.max(0, Math.round(Number(prod.stockFloor2 ?? 0)));
      const origCost = Number(prod.costPrice ?? 0);
      const origPrice = Number(prod.sellingPrice ?? 0);

      const newName = String(editingNames[prod._id] ?? origName).trim();
      const newNote = String(editingNotes[prod._id] ?? origNote).trim();
      const newCatId = String(editingCats[prod._id] ?? origCatId);
      const newUnit = String(editingUnits[prod._id] ?? origUnit).trim() || "Cái";
      const newF1 = Math.max(0, Math.round(Number(editingFloor1[prod._id] ?? origF1)));
      const newF2 = Math.max(0, Math.round(Number(editingFloor2[prod._id] ?? origF2)));
      const newCost = Number(editingCosts[prod._id] ?? origCost);
      const newPrice = Number(editingPrices[prod._id] ?? origPrice);

      return (
        newName !== origName ||
        newNote !== origNote ||
        newCatId !== origCatId ||
        newUnit !== origUnit ||
        newF1 !== origF1 ||
        newF2 !== origF2 ||
        newCost !== origCost ||
        newPrice !== origPrice
      );
    },
    [editingNames, editingNotes, editingCats, editingUnits, editingFloor1, editingFloor2, editingCosts, editingPrices]
  );

  // Danh sách các sản phẩm đã có chỉnh sửa (số lượng, giá, tên, ĐVT, danh mục)
  const changedProducts = useMemo(() => {
    return products.filter((p) => isProductChanged(p));
  }, [products, isProductChanged]);

  // Hoàn tác toàn bộ chỉnh sửa chưa lưu về dữ liệu gốc
  const handleResetProductEdits = () => {
    const nameMap: Record<string, string> = {};
    const noteMap: Record<string, string> = {};
    const catMap: Record<string, string> = {};
    const unitMap: Record<string, string> = {};
    const f1Map: Record<string, number> = {};
    const f2Map: Record<string, number> = {};
    const costMap: Record<string, number> = {};
    const priceMap: Record<string, number> = {};
    products.forEach((p) => {
      nameMap[p._id] = p.name || "";
      noteMap[p._id] = p.note || "";
      catMap[p._id] =
        typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
      unitMap[p._id] = p.unit || "Cái";
      f1Map[p._id] = Number(p.stockFloor1 ?? p.stock ?? 0);
      f2Map[p._id] = Number(p.stockFloor2 ?? 0);
      costMap[p._id] = Number(p.costPrice || 0);
      priceMap[p._id] = Number(p.sellingPrice || 0);
    });
    setEditingNames(nameMap);
    setEditingNotes(noteMap);
    setEditingCats(catMap);
    setEditingUnits(unitMap);
    setEditingFloor1(f1Map);
    setEditingFloor2(f2Map);
    setEditingCosts(costMap);
    setEditingPrices(priceMap);
    setStatusMsg(null);
  };

  // Lưu nhanh 1 sản phẩm trên dòng (hoặc bấm Enter)
  const handleSaveSingleProductRow = async (prod: Product) => {
    if (savingBatch) return;
    setStatusMsg(null);
    const newName = String(editingNames[prod._id] ?? prod.name ?? "").trim();
    const newNote = String(editingNotes[prod._id] ?? prod.note ?? "").trim();
    const newCatId = String(
      editingCats[prod._id] ??
      (typeof prod.categoryId === "object" ? prod.categoryId?._id : prod.categoryId) ??
      ""
    );
    const newUnit = String(editingUnits[prod._id] ?? prod.unit ?? "Cái").trim() || "Cái";
    const newF1 = Math.max(0, Math.round(Number(editingFloor1[prod._id] ?? prod.stockFloor1 ?? prod.stock ?? 0)));
    const newF2 = Math.max(0, Math.round(Number(editingFloor2[prod._id] ?? prod.stockFloor2 ?? 0)));
    const newCost = Number(editingCosts[prod._id] ?? prod.costPrice ?? 0);
    const newPrice = Number(editingPrices[prod._id] ?? prod.sellingPrice ?? 0);

    if (!newName) {
      setStatusMsg({ type: "error", text: `Tên sản phẩm (Mã: ${prod.code}) không được để trống.` });
      return;
    }

    setSavingBatch(true);
    try {
      await apiRequest(`/products/${prod._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: newName,
          note: newNote,
          ...(newCatId ? { categoryId: newCatId } : {}),
          unit: newUnit,
          stockFloor1: newF1,
          stockFloor2: newF2,
          stock: newF1 + newF2,
          allowDirectStock: true,
          costPrice: newCost,
          sellingPrice: newPrice,
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã lưu cập nhật mặt hàng "${newName}" (${prod.code})!`,
      });
      await loadProductsAndCats();
      loadCategoriesAndImports();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "Lỗi khi lưu sản phẩm." });
    } finally {
      setSavingBatch(false);
    }
  };

  // Hoàn tác riêng 1 dòng sản phẩm
  const handleResetSingleProductRow = (prod: Product) => {
    setEditingNames((prev) => ({ ...prev, [prod._id]: prod.name || "" }));
    setEditingNotes((prev) => ({ ...prev, [prod._id]: prod.note || "" }));
    setEditingCats((prev) => ({
      ...prev,
      [prod._id]: typeof prod.categoryId === "object" ? prod.categoryId?._id || "" : String(prod.categoryId || ""),
    }));
    setEditingUnits((prev) => ({ ...prev, [prod._id]: prod.unit || "Cái" }));
    setEditingFloor1((prev) => ({ ...prev, [prod._id]: Number(prod.stockFloor1 ?? prod.stock ?? 0) }));
    setEditingFloor2((prev) => ({ ...prev, [prod._id]: Number(prod.stockFloor2 ?? 0) }));
    setEditingCosts((prev) => ({ ...prev, [prod._id]: Number(prod.costPrice || 0) }));
    setEditingPrices((prev) => ({ ...prev, [prod._id]: Number(prod.sellingPrice || 0) }));
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
          text: `Số lượng, giá vốn và giá niêm yết của "${newName}" không được âm.`,
        });
        return;
      }
    }

    setSavingBatch(true);
    try {
      for (const prod of changedProducts) {
        const newName = String(editingNames[prod._id] ?? prod.name ?? "").trim();
        const newNote = String(editingNotes[prod._id] ?? prod.note ?? "").trim();
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
            note: newNote,
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
        text: `Đã lưu thành công ${changedProducts.length} mặt hàng có thay đổi (Số lượng tồn Kho Tầng 1 / Tầng 2, Giá vốn, Giá niêm yết)!`,
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

  // Gợi ý các sản phẩm đã có trong kho khi gõ tên hàng/mã hàng ở từng dòng trong Popup Nhập kho Admin
  const getAdminRowSuggestions = useCallback(
    (query: string): Product[] => {
      const sourceList = (allCatalogProducts.length > 0 ? allCatalogProducts : products).filter((p) => {
        const catId = typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
        if (importFilterCatId && catId !== importFilterCatId) return false;
        if (importFilterBrandId) {
          if (p.brandId) {
            if (String(p.brandId) !== importFilterBrandId) return false;
          } else {
            const b = brandOptions.find((x) => x._id === importFilterBrandId);
            if (!b) return false;
            const norm = (t?: string) =>
              String(t || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
            const keys = new Set([norm(b.name), norm(b.code), ...(b.aliases || []).map(norm)]);
            if (!keys.has(norm(p.brand))) return false;
          }
        }
        return true;
      });
      const q = (query || "").trim();
      if (!q) return sourceList.slice(0, 12);
      return filterAndRankBySearch(sourceList, q, (p) => [
        { text: p.code, weight: 1.6 },
        { text: p.legacyCode, weight: 1.3 },
        { text: p.name, weight: 1.4 },
        { text: p.versionName, weight: 1.3 },
        { text: p.brandName || p.brand, weight: 1.1 },
        { text: p.categoryName, weight: 0.9 },
        ...(Array.isArray(p.variants)
          ? p.variants.map((v) => ({
            text: `${v.variantCode || ""} ${v.color || ""} ${v.size || ""}`,
            weight: 1.4,
          }))
          : []),
      ]).slice(0, 12);
    },
    [allCatalogProducts, products, importFilterCatId, importFilterBrandId, brandOptions]
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
      const vars = (prod.variants || []).filter((v) => v.color || v.size);
      const firstVar = vars[0];
      const vColor = firstVar ? firstVar.color || "" : prod.color || "";
      const vSize = firstVar ? firstVar.size || "" : prod.size || "";
      const vHexes = firstVar?.colorHexes || prod.colorHexes;
      const vCode = firstVar ? resolveVariantCode(prod, prod.code, vColor, vSize) : prod.code;
      next[rowIdx] = {
        ...cur,
        productId: prod._id,
        productName: prod.name,
        productCode: prod.code || "",
        variantCode: vCode,
        isNewVariant: vars.length === 0,
        brand: prod.brandName || prod.brand || cur.brand || "",
        categoryId: catId,
        color: vColor,
        colorHexes: vHexes,
        size: vSize,
        unit: prod.unit || cur.unit || "Cái",
        costPrice: variantEffectiveCostPrice(prod, firstVar),
        sellingPrice: variantEffectiveSellingPrice(prod, firstVar),
      };
      return next;
    });
    setActiveAdminSuggestRowIdx(null);
  };

  const handleSelectAdminRowVariant = (rowIdx: number, prod: Product, selectedVal: string) => {
    setAdminImportRows((prev) => {
      const next = [...prev];
      const cur = next[rowIdx];
      if (!cur) return prev;
      if (selectedVal === "__NEW__") {
        next[rowIdx] = {
          ...cur,
          isNewVariant: true,
          variantCode: undefined,
          color: "",
          colorHexes: [],
          size: "",
          costPrice: Number(prod.costPrice || 0),
          sellingPrice: Number(prod.sellingPrice || 0),
        };
        return next;
      }
      const [cRaw, sRaw] = selectedVal.split("||");
      const matched = findVariantByColorSize(prod, cRaw, sRaw);
      const vColor = matched?.color ?? cRaw ?? "";
      const vSize = matched?.size ?? sRaw ?? "";
      next[rowIdx] = {
        ...cur,
        isNewVariant: false,
        color: vColor,
        colorHexes: matched?.colorHexes,
        size: vSize,
        variantCode: resolveVariantCode(prod, prod.code, vColor, vSize),
        costPrice: variantEffectiveCostPrice(prod, matched),
        sellingPrice: variantEffectiveSellingPrice(prod, matched),
      };
      return next;
    });
  };

  const handleClearAdminRowProduct = (rowIdx: number) => {
    setAdminImportRows((prev) => {
      const next = [...prev];
      const cur = next[rowIdx];
      if (!cur) return prev;
      next[rowIdx] = {
        ...cur,
        productId: undefined,
        productCode: "",
        variantCode: undefined,
        isNewVariant: false,
        productName: "",
        color: "",
        colorHexes: [],
        size: "",
        costPrice: 0,
        sellingPrice: 0,
      };
      return next;
    });
    setActiveAdminSuggestRowIdx(rowIdx);
  };

  const handleUpdateAdminRow = (index: number, field: keyof AdminImportRow, value: any) => {
    setAdminImportRows((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      const cat = categories.find((c) => c._id === String(item.categoryId || newProdCatId));

      // v5.0: KHÔNG tự sinh mã ở client. Dòng gắn sản phẩm có sẵn (productId) giữ mã server;
      // đổi tên/danh mục/hãng => tách khỏi sản phẩm cũ, server sẽ sinh mã mới (Cate + Brand + Version).
      if (field === "productName") {
        const linked = item.productId
          ? (allCatalogProducts.length > 0 ? allCatalogProducts : products).find((p) => p._id === item.productId)
          : undefined;
        if (!linked || linked.name !== String(value)) {
          item.productId = undefined;
          item.productCode = "";
        }
        const extracted = extractVariantFromText(String(value), {
          categoryCode: cat?.code,
          categoryName: cat?.name,
          brand: item.brand,
        });
        if (!item.brand && extracted.brand) item.brand = extracted.brand;
        if (!item.color && extracted.color) item.color = extracted.color;
        if (!item.size && extracted.size) item.size = extracted.size;
      }

      if (field === "categoryId") {
        item.categoryId = String(value || "");
        item.productId = undefined;
        item.productCode = "";
      }

      if (field === "brand") {
        item.brand = String(value || "");
        item.productId = undefined;
        item.productCode = "";
      }

      if (field === "productCode") {
        item.productId = undefined;
        item.productCode = String(value || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
      }

      if (field === "colorCode") {
        item.colorCode = String(value || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 3);
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
        colorHexes: Array.isArray(source.colorHexes) ? [...source.colorHexes] : [],
        size: "",
        isConfirmed: false,
      };
      const next = [...prev.slice(0, index + 1), cloned, ...prev.slice(index + 1)];
      return next.map((r, idx) => ({ ...r, stt: idx + 1 }));
    });
  };

  const handleUpdateAdminRowColor = (
    index: number,
    nextColor: string,
    nextHexes: string[]
  ) => {
    setAdminImportRows((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      const updated = { ...cur, color: nextColor, colorHexes: nextHexes };
      next[index] = updated;
      const cleanColorKey = String(nextColor || "").trim().toLowerCase();
      if (updated.productCode && cleanColorKey && nextHexes.length > 0) {
        for (let i = 0; i < next.length; i++) {
          if (
            i !== index &&
            next[i].productCode === updated.productCode &&
            String(next[i].color || "").trim().toLowerCase() === cleanColorKey
          ) {
            next[i] = { ...next[i], colorHexes: nextHexes };
          }
        }
      }
      return next;
    });
  };

  // v5.0: sau khi tạo SP chuẩn mã / thêm biến thể => nạp lại danh mục và (nếu đang mở phiếu nhập) thêm dòng theo từng biến thể
  const handleCodeCreatorDone = async (result: ProductCodeCreatorResult) => {
    const { product, variants, mode } = result;
    setEditingProductModal(null);
    setStatusMsg({
      type: "success",
      text:
        mode === "CREATED"
          ? `Đã tạo sản phẩm "${product.name}" mã ${product.code}.`
          : mode === "UPDATED"
            ? `Đã cập nhật sản phẩm "${product.name}" mã ${product.code}.`
            : `Đã thêm ${variants.length} biến thể vào sản phẩm ${product.code}.`,
    });
    setAllCatalogProducts((prev) => [product, ...prev.filter((p) => p._id !== product._id)]);
    loadProductsAndCats();
    if (!showAdminImportModal || mode === "UPDATED") return;
    const catId =
      typeof product.categoryId === "object" ? product.categoryId?._id || "" : String(product.categoryId || "");
    const lines = variants.length > 0 ? variants : [{ color: "", size: "" }];
    setAdminImportRows((prev) => {
      const base = prev.filter((r) => r.productName.trim() !== "" || r.productCode.trim() !== "");
      const added: AdminImportRow[] = lines.map((v) => {
        const pv = findVariantByColorSize(product, v.color, v.size);
        return {
          stt: 0,
          productId: product._id,
          productCode: product.code,
          variantCode: resolveVariantCode(product, product.code, v.color, v.size),
          isNewVariant: false,
          productName: product.name,
          categoryId: catId,
          brand: product.brandName || product.brand || "",
          color: v.color || "",
          colorHexes: pv?.colorHexes,
          size: v.size || "",
          unit: product.unit || "Cái",
          quantity: 1,
          costPrice: variantEffectiveCostPrice(product, pv),
          sellingPrice: variantEffectiveSellingPrice(product, pv),
          note: "",
          isConfirmed: false,
        };
      });
      return [...base, ...added].map((r, idx) => ({ ...r, stt: idx + 1 }));
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
      ["Mã SP", "Tên sản phẩm", "Hãng", "Màu sắc", "Size", "ĐVT", "Số lượng", "Giá vốn", "Giá niêm yết", "Ghi chú"],
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
        return {
          stt: idx + 1,
          // v5.0: mã do server đề xuất/khớp khi parse file — client không tự sinh
          productId: it.productId ? String(it.productId) : undefined,
          productCode: String(it.productCode || ""),
          colorCode: it.colorCode ? String(it.colorCode) : undefined,
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
        const actorLabel = getStoredUser()?.fullName || "Nhân sự kho";
        setAdminImportNote(`${actorLabel} nhập kho từ file ${file.name}`);
      }
    } catch (err: any) {
      alert(err?.message || `Lỗi khi đọc file "${file.name}".`);
    } finally {
      setImportingAdminFile(false);
    }
  };

  const handleSubmitAdminBatchImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingImportRef.current || submittingAdminImport) return;
    setStatusMsg(null);

    const validRows = adminImportRows.filter(
      (r) => r.productName.trim() !== "" || r.productCode.trim() !== "" || Boolean(r.productId)
    );
    if (validRows.length === 0) {
      alert("Vui lòng chọn hoặc import ít nhất 1 dòng sản phẩm!");
      return;
    }

    const confirmedRows = validRows.filter((r) => r.isConfirmed);
    if (confirmedRows.length === 0) {
      alert(
        "Vui lòng tick xác nhận các dòng cần nhập (hoặc bấm 'Tick xác nhận tất cả') trước khi Hoàn thành Nhập Kho!"
      );
      return;
    }

    const invalidProdRow = confirmedRows.find((r) => {
      const matched =
        (r.productId &&
          (allCatalogProducts.length > 0 ? allCatalogProducts : products).find((p) => p._id === r.productId)) ||
        (r.productCode && catalogByCode.get(r.productCode.toUpperCase()));
      return !matched && !r.productId && !r.productCode;
    });
    if (invalidProdRow) {
      alert(
        `Dòng #${invalidProdRow.stt} chưa chọn Sản phẩm hợp lệ từ danh mục! Vui lòng chọn sản phẩm có sẵn hoặc bấm "+ Tạo SP mới" trên thanh công cụ.`
      );
      return;
    }

    const missingColorRow = confirmedRows.find((r) => !String(r.color || "").trim());
    if (missingColorRow) {
      alert(
        `Dòng #${missingColorRow.stt} ("${missingColorRow.productName}") chưa chọn biến thể hoặc chưa điền Màu sắc! Vui lòng chọn Biến thể (Màu • Size) trước khi nhập kho.`
      );
      return;
    }

    submittingImportRef.current = true;
    setSubmittingAdminImport(true);
    const floorText = newProdWarehouse === "FLOOR_2" ? "Kho Tầng 2" : "Kho Tầng 1";
    let createdReceiptId: string | null = null;
    try {
      const actor = getStoredUser();
      const actorLabel = actor?.fullName || "Nhân sự kho";
      const payloadItems = validRows.map((r, idx) => {
        const matchedProd =
          (r.productId &&
            (allCatalogProducts.length > 0 ? allCatalogProducts : products).find((p) => p._id === r.productId)) ||
          (r.productCode ? catalogByCode.get(r.productCode.toUpperCase()) : undefined);
        return {
          stt: idx + 1,
          // v5.0: gửi productId/productCode của sản phẩm đã chọn
          ...(r.productId || matchedProd?._id ? { productId: r.productId || matchedProd?._id } : {}),
          ...(r.productCode || matchedProd?.code ? { productCode: r.productCode || matchedProd?.code } : {}),
          ...(r.colorCode ? { colorCode: r.colorCode } : {}),
          productName: (r.productName || matchedProd?.name || "").trim(),
          brand: (r.brand || matchedProd?.brandName || matchedProd?.brand || "").trim(),
          color: r.color.trim(),
          colorHexes: resolveVariantColorHexes(r.color, r.colorHexes),
          size: r.size.trim().toUpperCase(),
          categoryId:
            r.categoryId ||
            (typeof matchedProd?.categoryId === "object"
              ? matchedProd.categoryId?._id
              : matchedProd?.categoryId) ||
            newProdCatId ||
            categories[0]?._id,
          unit: (r.unit || matchedProd?.unit || "Cái").trim() || "Cái",
          expectedQuantity: Math.max(1, Number(r.quantity || 1)),
          actualQuantity: Math.max(1, Number(r.quantity || 1)),
          costPrice: Math.max(0, Number(r.costPrice || 0)),
          sellingPrice: Math.max(0, Number(r.sellingPrice || 0)),
          note: r.note.trim(),
          isChecked: true,
          isConfirmed: r.isConfirmed,
          discrepancyNote: "Khớp đủ",
          ...(actor?._id ? { checkedBy: actor._id } : {}),
          ...(actor?.fullName ? { checkedByName: actor.fullName } : {}),
          ...(actor?.role ? { checkedByRole: actor.role } : {}),
        };
      });

      const createdRes = await apiRequest<any>("/imports", {
        method: "POST",
        body: JSON.stringify({
          note: adminImportNote.trim() || `${actorLabel} nhập kho (${confirmedRows.length} dòng)`,
          defaultCategoryId: newProdCatId || categories[0]?._id || undefined,
          targetWarehouse: newProdWarehouse,
          items: payloadItems,
        }),
      });

      const savedReceipt = createdRes.data;
      createdReceiptId = savedReceipt?._id || null;
      await apiRequest<any>(`/imports/${savedReceipt._id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          defaultCategoryId: newProdCatId || categories[0]?._id || undefined,
          targetWarehouse: newProdWarehouse,
          items: savedReceipt.items || payloadItems,
        }),
      });
      createdReceiptId = null;

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
      if (subTab === "HISTORY") {
        loadImports();
        loadMovements();
      }
    } catch (err: any) {
      // Nếu đã tạo phiếu DRAFT nhưng bước hoàn thành lỗi thì dọn phiếu DRAFT để tránh rác/trùng khi bấm thử lại
      if (createdReceiptId) {
        await apiRequest(`/imports/${createdReceiptId}`, { method: "DELETE" }).catch(() => {});
      }
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể nhập sản phẩm vào kho.",
      });
    } finally {
      submittingImportRef.current = false;
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
            colorHexes: resolveVariantColorHexes(v.color, v.colorHexes),
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

  // v5.0 (R8): sửa giá bán/giá vốn riêng của biến thể qua PATCH /products/:id { variantPrices }
  const handleSaveVariantPrice = async (
    prod: Product,
    v: ProductVariant,
    field: "sellingPrice" | "costPrice",
    value: number
  ) => {
    const next = Math.max(0, Math.round(Number(value) || 0));
    if (next === Math.max(0, Number(v[field] || 0))) return;
    if (!v.variantKey && !v.variantCode) return;
    try {
      await apiRequest(`/products/${prod._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          variantPrices: [
            {
              ...(v.variantKey ? { variantKey: v.variantKey } : { variantCode: v.variantCode }),
              [field]: next,
            },
          ],
        }),
      });
      setEditingVariants((prev) => ({
        ...prev,
        [prod._id]: (prev[prod._id] || prod.variants || []).map((it) =>
          (v.variantKey && it.variantKey === v.variantKey) || (!v.variantKey && it.variantCode === v.variantCode)
            ? { ...it, [field]: next }
            : it
        ),
      }));
      setStatusMsg({
        type: "success",
        text: `Đã cập nhật ${field === "sellingPrice" ? "giá niêm yết" : "giá vốn"} riêng cho ${v.variantCode || `${v.color} ${v.size}`}${next === 0 ? " (dùng giá mặc định)" : ""}.`,
      });
      loadProductsAndCats();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: describeApiError(err, "Không lưu được giá biến thể.") });
    }
  };

  const handleAddVariantToProduct = async (prod: Product) => {
    const draft = newVariantInputs[prod._id] || {
      color: "",
      colorHexes: [],
      size: "",
      stockFloor1: activeWarehouse === "FLOOR_2" ? 0 : 1,
      stockFloor2: activeWarehouse === "FLOOR_2" ? 1 : 0,
    };
    const color = draft.color.trim();
    const colorHexes = resolveVariantColorHexes(color, draft.colorHexes);
    const size = draft.size.trim().toUpperCase();
    if (!color) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng nhập Màu sắc (bắt buộc) để thêm phân loại mới vào kho.",
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
        colorHexes:
          colorHexes.length > 0 ? colorHexes : current[existingIdx].colorHexes,
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
        colorHexes,
        size,
        stockFloor1: f1,
        stockFloor2: f2,
        stock: f1 + f2,
      });
    }
    setEditingVariants((prev) => ({ ...prev, [prod._id]: current }));
    setNewVariantInputs((prev) => ({
      ...prev,
      [prod._id]: { color: "", colorHexes: [], size: "", stockFloor1: 1, stockFloor2: 0 },
    }));
    await handleSaveProductVariants(prod, current);
  };

  // Mở modal in tem mã vạch theo Mã con của từng thuộc tính (Màu sắc + Size), không in mã gốc khi có biến thể
  const buildLabelItemsForProduct = (
    prod: Product,
    specificVariant?: ProductVariant
  ): BarcodeLabelItem[] => {
    const sellPrice = Number(editingPrices[prod._id] ?? prod.sellingPrice ?? 0);
    const prodVariants = editingVariants[prod._id] ?? prod.variants ?? [];
    const namedVars = prodVariants.filter((v) => v.color || v.size);
    // R8: giá biến thể riêng (> 0) ưu tiên, trống => giá gốc
    const variantSellPrice = (v: ProductVariant) =>
      Number(v.sellingPrice || 0) > 0 ? Number(v.sellingPrice) : sellPrice;

    if (specificVariant) {
      const childCode = variantCodeFor(
        prod.code,
        specificVariant.color,
        specificVariant.size
      );
      const vQty =
        activeWarehouse === "FLOOR_2"
          ? Number(specificVariant.stockFloor2 || 0)
          : activeWarehouse === "FLOOR_1"
            ? Number(specificVariant.stockFloor1 || 0)
            : (Number(specificVariant.stockFloor1) || 0) +
            (Number(specificVariant.stockFloor2) || 0);
      return [
        {
          id: `${prod._id}_${childCode}`,
          code: childCode,
          productCode: prod.code,
          productName: prod.name,
          color: specificVariant.color,
          size: specificVariant.size,
          sellingPrice: variantSellPrice(specificVariant),
          unit: prod.unit,
          defaultQty: Math.max(1, vQty || 1),
        },
      ];
    }

    if (namedVars.length > 0) {
      return namedVars.map((v, idx) => {
        const childCode = variantCodeFor(prod.code, v.color, v.size);
        const vQty =
          activeWarehouse === "FLOOR_2"
            ? Number(v.stockFloor2 || 0)
            : activeWarehouse === "FLOOR_1"
              ? Number(v.stockFloor1 || 0)
              : (Number(v.stockFloor1) || 0) + (Number(v.stockFloor2) || 0);
        return {
          id: `${prod._id}_${childCode}_${idx}`,
          code: childCode,
          productCode: prod.code,
          productName: prod.name,
          color: v.color,
          size: v.size,
          sellingPrice: variantSellPrice(v),
          unit: prod.unit,
          defaultQty: Math.max(1, vQty || 1),
        };
      });
    }

    const qty = Math.max(1, getActiveQty(prod) || 1);
    return [
      {
        id: prod._id,
        code: prod.code,
        productCode: prod.code,
        productName: prod.name,
        sellingPrice: sellPrice,
        unit: prod.unit,
        defaultQty: qty,
      },
    ];
  };

  const handleOpenPrintLabelForProduct = (
    prod: Product,
    specificVariant?: ProductVariant
  ) => {
    setLabelItems(buildLabelItemsForProduct(prod, specificVariant));
    setShowLabelModal(true);
  };

  const handleOpenPrintLabelsForDisplayed = () => {
    const list: BarcodeLabelItem[] = displayedProducts
      .slice(0, 50)
      .flatMap((prod) => buildLabelItemsForProduct(prod));
    setLabelItems(list);
    setShowLabelModal(true);
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
      ...(Array.isArray(p.variants)
        ? p.variants.map((v) => ({
          text: `${v.variantCode || variantCodeFor(p.code, v.color, v.size)} ${v.color || ""} ${v.size || ""}`,
          weight: 1.4,
        }))
        : []),
    ]);
  }, [products, transferDirection, debouncedTransferSearch]);

  const getSourceFloorStock = (p?: Product): number => {
    if (!p) return 0;
    const f1 = Number(p.stockFloor1 ?? p.stock) || 0;
    const f2 = Number(p.stockFloor2) || 0;
    return transferDirection === "F1_TO_F2" ? f1 : f2;
  };

  const getVariantSourceFloorStock = (
    v?: { stockFloor1?: number; stockFloor2?: number; stock?: number },
    dir: "F1_TO_F2" | "F2_TO_F1" = transferDirection
  ): number => {
    if (!v) return 0;
    const f1 = Number(v.stockFloor1 ?? v.stock ?? 0);
    const f2 = Number(v.stockFloor2 ?? 0);
    return dir === "F1_TO_F2" ? f1 : f2;
  };

  const getProductSourceVariants = (
    p?: Product,
    dir: "F1_TO_F2" | "F2_TO_F1" = transferDirection
  ) => {
    const vars = Array.isArray(p?.variants) ? p!.variants! : [];
    const withStock = vars.filter((v) => getVariantSourceFloorStock(v, dir) > 0);
    return withStock.length > 0 ? withStock : vars;
  };

  const getSourceVariantFloorStock = (
    p?: Product,
    color?: string,
    size?: string
  ): number => {
    if (!p) return 0;
    const cNorm = String(color || "").trim().toLowerCase();
    const sNorm = String(size || "").trim().toUpperCase();
    const vars = Array.isArray(p.variants) ? p.variants : [];
    if (vars.length > 0 && (cNorm || sNorm)) {
      const exact = vars.find(
        (v) =>
          String(v.color || "").trim().toLowerCase() === cNorm &&
          String(v.size || "").trim().toUpperCase() === sNorm
      );
      if (exact) {
        return getVariantSourceFloorStock(exact);
      }
      if (cNorm && !sNorm) {
        const byColor = vars.filter(
          (v) => String(v.color || "").trim().toLowerCase() === cNorm
        );
        if (byColor.length > 0) {
          return byColor.reduce((sum, v) => sum + getVariantSourceFloorStock(v), 0);
        }
      }
    }
    return getSourceFloorStock(p);
  };

  const getTransferItemKey = (productId: string, color?: string, size?: string) =>
    `${productId}__${String(color || "").trim().toLowerCase()}__${String(size || "").trim().toUpperCase()}`;

  const syncDefaultTransferVariantForProduct = (
    prod?: Product,
    dir: "F1_TO_F2" | "F2_TO_F1" = transferDirection
  ) => {
    const availVars = getProductSourceVariants(prod, dir);
    if (availVars.length > 0) {
      setTransferColor(availVars[0].color || "");
      setTransferSize(availVars[0].size || "");
    } else {
      setTransferColor(prod?.color || "");
      setTransferSize(prod?.size || "");
    }
  };

  const handleSelectTransferProduct = (prodId: string) => {
    setTransferProductId(prodId);
    const prod = products.find((p) => p._id === prodId);
    syncDefaultTransferVariantForProduct(prod, transferDirection);
  };

  const handleChangeTransferDirection = (dir: "F1_TO_F2" | "F2_TO_F1") => {
    setTransferDirection(dir);
    setTransferItems([]);
    setTransferSearch("");
    setTransferProductId("");
    setTransferColor("");
    setTransferSize("");
    setTransferQty(1);
    setTransferSuggestOpen(false);
  };

  const handleAddTransferItem = (
    prodId?: string,
    qtyToAdd?: number,
    explicitColor?: string,
    explicitSize?: string
  ) => {
    setStatusMsg(null);
    const targetId = prodId || transferProductId;
    if (!targetId) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng chọn sản phẩm cần chuyển kho.",
      });
      return;
    }
    const prod = products.find((p) => p._id === targetId);
    if (!prod) return;

    const prodVars = getProductSourceVariants(prod);
    let chosenColor =
      explicitColor !== undefined
        ? explicitColor
        : targetId === (transferProductId || sourceFloorProducts[0]?._id)
          ? transferColor
          : "";
    let chosenSize =
      explicitSize !== undefined
        ? explicitSize
        : targetId === (transferProductId || sourceFloorProducts[0]?._id)
          ? transferSize
          : "";

    if (!chosenColor && !chosenSize && prodVars.length > 0) {
      chosenColor = prodVars[0].color || "";
      chosenSize = prodVars[0].size || "";
    }

    const cleanColor = String(chosenColor || "").trim();
    const cleanSize = String(chosenSize || "").trim().toUpperCase();
    const maxAvail = getSourceVariantFloorStock(prod, cleanColor, cleanSize);

    if (maxAvail <= 0) {
      const variantText = [cleanColor ? `Màu ${cleanColor}` : "", cleanSize ? `Size ${cleanSize}` : ""]
        .filter(Boolean)
        .join(" - ");
      setStatusMsg({
        type: "error",
        text: `Sản phẩm "${prod.name}"${variantText ? ` (${variantText})` : ""} không còn tồn ở kho đầu dời.`,
      });
      return;
    }
    const addQty = Math.max(1, Math.round(Number(qtyToAdd ?? transferQty) || 1));
    const targetKey = getTransferItemKey(targetId, cleanColor, cleanSize);

    setTransferItems((prev) => {
      const existing = prev.find(
        (i) => getTransferItemKey(i.productId, i.color, i.size) === targetKey
      );
      if (existing) {
        const nextQty = Math.min(maxAvail, existing.quantity + addQty);
        return prev.map((i) =>
          getTransferItemKey(i.productId, i.color, i.size) === targetKey
            ? { ...i, quantity: nextQty }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: targetId,
          color: cleanColor,
          size: cleanSize,
          quantity: Math.min(maxAvail, addQty),
        },
      ];
    });
    setTransferQty(1);
  };

  const handleUpdateTransferItemVariant = (
    itemKey: string,
    nextColor: string,
    nextSize: string
  ) => {
    const cleanColor = String(nextColor || "").trim();
    const cleanSize = String(nextSize || "").trim().toUpperCase();
    setTransferItems((prev) => {
      const target = prev.find(
        (i) => getTransferItemKey(i.productId, i.color, i.size) === itemKey
      );
      if (!target) return prev;
      const prod = products.find((p) => p._id === target.productId);
      const maxAvail = Math.max(1, getSourceVariantFloorStock(prod, cleanColor, cleanSize));
      const newKey = getTransferItemKey(target.productId, cleanColor, cleanSize);
      if (newKey !== itemKey && prev.some((i) => getTransferItemKey(i.productId, i.color, i.size) === newKey)) {
        // Gộp số lượng nếu biến thể mới đã có trong danh sách
        return prev
          .map((i) => {
            const k = getTransferItemKey(i.productId, i.color, i.size);
            if (k === newKey) {
              return { ...i, quantity: Math.min(maxAvail, i.quantity + target.quantity) };
            }
            return i;
          })
          .filter((i) => getTransferItemKey(i.productId, i.color, i.size) !== itemKey);
      }
      return prev.map((i) =>
        getTransferItemKey(i.productId, i.color, i.size) === itemKey
          ? {
            ...i,
            color: cleanColor,
            size: cleanSize,
            quantity: Math.min(maxAvail, i.quantity),
          }
          : i
      );
    });
  };

  const handleUpdateTransferItemQty = (itemKey: string, newQty: number) => {
    if (newQty <= 0) {
      setTransferItems((prev) =>
        prev.filter((i) => getTransferItemKey(i.productId, i.color, i.size) !== itemKey)
      );
      return;
    }
    setTransferItems((prev) =>
      prev.map((i) => {
        if (getTransferItemKey(i.productId, i.color, i.size) !== itemKey) return i;
        const prod = products.find((p) => p._id === i.productId);
        const maxAvail = Math.max(1, getSourceVariantFloorStock(prod, i.color, i.size));
        const clamped = Math.min(maxAvail, Math.max(1, Math.round(newQty)));
        return { ...i, quantity: clamped };
      })
    );
  };

  const handleRemoveTransferItem = (itemKey: string) => {
    setTransferItems((prev) =>
      prev.filter((i) => getTransferItemKey(i.productId, i.color, i.size) !== itemKey)
    );
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const activeProdId = transferProductId || sourceFloorProducts[0]?._id || "";
    const activeProd = products.find((p) => p._id === activeProdId);
    const defaultVars = getProductSourceVariants(activeProd);
    const fallbackColor =
      transferColor || (defaultVars.length > 0 ? defaultVars[0].color || "" : "");
    const fallbackSize =
      transferSize || (defaultVars.length > 0 ? defaultVars[0].size || "" : "");

    // Nếu danh sách phiếu đang trống mà Admin chọn 1 SP trên thanh chọn nhanh thì lấy luôn SP + Màu/Size đó
    const finalItems =
      transferItems.length > 0
        ? transferItems
        : activeProdId && Number(transferQty) > 0
          ? [
            {
              productId: activeProdId,
              color: fallbackColor,
              size: fallbackSize,
              quantity: Math.round(Number(transferQty)),
            },
          ]
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

  const handleOpenSetLinkModal = (prod: Product) => {
    const isLikelySet =
      (Array.isArray(prod.linkedRetailProducts) && prod.linkedRetailProducts.length > 0) ||
      (!prod.parentSetProductId &&
        /hộp|bộ|ống|lốc|thùng|set|box|pack|túi/i.test(`${prod.unit || ""} ${prod.name || ""}`));
    setSetLinkModalProduct(prod);
    setSetLinkMode(isLikelySet ? "AS_SET" : "AS_RETAIL");
    setSelectedParentSetId(prod.parentSetProductId || "");
    setPackSizeInput(
      prod.packSize && prod.packSize > 0
        ? prod.packSize
        : prod.linkedRetailProducts?.[0]?.packSize || 12
    );
    setSetLinkSearch("");
    setSetChildMode("CREATE_NEW_RETAIL");
    setSelectedExistingRetailId(prod.linkedRetailProducts?.[0]?._id || "");
    const cleanBaseName = prod.name.replace(/\s*\((?:hộp|bộ|ống|lốc|set)[^)]*\)/gi, "").trim();
    setNewRetailName(`${cleanBaseName} (Bán lẻ)`);
    setNewRetailUnit(/ống|cầu/i.test(prod.name) ? "Quả" : /vớ|tất|giày/i.test(prod.name) ? "Đôi" : "Cái");
    const defaultPack = prod.linkedRetailProducts?.[0]?.packSize || 12;
    setNewRetailSellingPrice(
      prod.sellingPrice > 0 ? Math.ceil(prod.sellingPrice / defaultPack / 1000) * 1000 : 0
    );
    setModalUnpackCount(1);
    setModalUnpackWarehouse(activeWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1");
  };

  const handleQuickUnpackSet = async (
    retailProductId: string,
    setsToUnpack = 1,
    warehouseOverride?: WarehouseFloor
  ) => {
    const targetWh: WarehouseFloor =
      warehouseOverride || (activeWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1");
    setUnpackingLoadingId(retailProductId);
    setStatusMsg(null);
    try {
      const res = await apiRequest<any>("/inventory/unpack-set", {
        method: "POST",
        body: JSON.stringify({
          retailProductId,
          setsToUnpack,
          warehouse: targetWh,
          reason: "Tách bộ 1 chạm trên CMS",
        }),
      });
      const d = res.data;
      const whLabel = targetWh === "FLOOR_2" ? "Kho Tầng 2" : "Kho Tầng 1";
      setStatusMsg({
        type: "success",
        text: `⚡ Đã tách ${d.setsUnpacked} ${d.setProduct?.unit || "Bộ"} "${d.setProduct?.name}" (-${d.setsUnpacked} ${d.setProduct?.unit || "Bộ"}) → Cộng +${d.addedRetailQuantity} ${d.retailProduct?.unit || "Cái"} vào "${d.retailProduct?.name}" tại ${whLabel} (Mã phiếu: ${d.referenceCode})!`,
      });
      await Promise.all([loadProductsAndCats(), loadCategoriesAndImports(), loadMovements()]);
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể tách sản phẩm bộ sang lẻ.",
      });
    } finally {
      setUnpackingLoadingId(null);
    }
  };

  const handleSaveSetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setLinkModalProduct) return;
    const validPack = Math.max(1, Math.round(Number(packSizeInput) || 0));
    setSavingSetLink(true);
    setStatusMsg(null);
    try {
      if (setLinkMode === "AS_RETAIL") {
        if (!selectedParentSetId) {
          setStatusMsg({
            type: "error",
            text: "Vui lòng chọn Sản phẩm Bộ/Hộp gốc để liên kết.",
          });
          setSavingSetLink(false);
          return;
        }
        await apiRequest(`/products/${setLinkModalProduct._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            parentSetProductId: selectedParentSetId,
            packSize: validPack,
          }),
        });
        setStatusMsg({
          type: "success",
          text: `Đã liên kết "${setLinkModalProduct.name}" với Sản phẩm Bộ (Tỷ lệ: 1 Bộ = ${validPack} ${setLinkModalProduct.unit}). Khi bán lẻ hết hàng tại Tầng 1, hệ thống sẽ tự động trừ 1 Bộ và cộng +${validPack} ${setLinkModalProduct.unit}!`,
        });
      } else {
        if (setChildMode === "EXISTING_RETAIL") {
          if (!selectedExistingRetailId) {
            setStatusMsg({
              type: "error",
              text: "Vui lòng chọn Sản phẩm Lẻ có sẵn để gắn vào Bộ này.",
            });
            setSavingSetLink(false);
            return;
          }
          await apiRequest(`/products/${selectedExistingRetailId}`, {
            method: "PATCH",
            body: JSON.stringify({
              parentSetProductId: setLinkModalProduct._id,
              packSize: validPack,
            }),
          });
          setStatusMsg({
            type: "success",
            text: `Đã gắn Sản phẩm Lẻ vào Bộ "${setLinkModalProduct.name}" (1 ${setLinkModalProduct.unit} = ${validPack} đơn vị lẻ)!`,
          });
        } else {
          const cleanName = newRetailName.trim();
          if (!cleanName) {
            setStatusMsg({
              type: "error",
              text: "Vui lòng nhập tên cho Sản phẩm Lẻ mới.",
            });
            setSavingSetLink(false);
            return;
          }
          const catId =
            typeof setLinkModalProduct.categoryId === "object"
              ? setLinkModalProduct.categoryId?._id || ""
              : String(setLinkModalProduct.categoryId || "");
          const estCost =
            Number(setLinkModalProduct.costPrice) > 0
              ? Math.round(Number(setLinkModalProduct.costPrice) / validPack)
              : 0;
          await apiRequest("/products", {
            method: "POST",
            body: JSON.stringify({
              name: cleanName,
              brand: setLinkModalProduct.brand || "",
              categoryId: catId,
              unit: newRetailUnit.trim() || "Cái",
              sellingPrice: Math.max(0, Math.round(Number(newRetailSellingPrice) || 0)),
              costPrice: estCost,
              quantity: 0,
              targetWarehouse: "FLOOR_1",
              parentSetProductId: setLinkModalProduct._id,
              packSize: validPack,
            }),
          });
          setStatusMsg({
            type: "success",
            text: `Đã tạo mới Sản phẩm Lẻ "${cleanName}" và liên kết tự động với Bộ "${setLinkModalProduct.name}" (1 ${setLinkModalProduct.unit} = ${validPack} ${newRetailUnit.trim() || "Cái"})!`,
          });
        }
      }
      setSetLinkModalProduct(null);
      await Promise.all([loadProductsAndCats(), loadCategoriesAndImports()]);
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể lưu cấu hình liên kết Bộ ↔ Lẻ.",
      });
    } finally {
      setSavingSetLink(false);
    }
  };

  const handleClearSetLink = async (retailProdId: string) => {
    setSavingSetLink(true);
    try {
      await apiRequest(`/products/${retailProdId}`, {
        method: "PATCH",
        body: JSON.stringify({
          parentSetProductId: "",
          packSize: 0,
        }),
      });
      setStatusMsg({
        type: "success",
        text: "Đã gỡ liên kết Sản phẩm Bộ ↔ Lẻ.",
      });
      setSetLinkModalProduct(null);
      await Promise.all([loadProductsAndCats(), loadCategoriesAndImports()]);
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể gỡ liên kết.",
      });
    } finally {
      setSavingSetLink(false);
    }
  };

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
        return (
          f1 > 0 ||
          (Number(p.maxUnpackableFloor1) || 0) > 0 ||
          floor1ImportedCodes.has(p.code) ||
          !floor2ImportedCodes.has(p.code)
        );
      }
      if (activeWarehouse === "FLOOR_2") {
        if (showZeroFloorItems || scannedCheckCounts[p._id]) return true;
        return f2 > 0 || floor2ImportedCodes.has(p.code);
      }
      return true;
    }).filter((p) => {
      if (!brandFilter) return true;
      if (p.brandId) return String(p.brandId) === brandFilter;
      // Sản phẩm cũ chưa gắn brandId: khớp theo tên hãng / alias
      const b = brandOptions.find((x) => x._id === brandFilter);
      if (!b) return false;
      const norm = (t?: string) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const keys = new Set([norm(b.name), norm(b.code), ...(b.aliases || []).map(norm)]);
      return keys.has(norm(p.brand));
    }).filter((p) => {
      if (quickStockFilter === "ALL") return true;
      const f1 = Number(editingFloor1[p._id] ?? p.stockFloor1 ?? p.stock ?? 0);
      const f2 = Number(editingFloor2[p._id] ?? p.stockFloor2 ?? 0);
      const q = activeWarehouse === "FLOOR_1" ? f1 : activeWarehouse === "FLOOR_2" ? f2 : f1 + f2;
      if (quickStockFilter === "IN_STOCK") return q > 0;
      if (quickStockFilter === "ZERO_STOCK") return q <= 0;
      if (quickStockFilter === "MISSING_PRICE") {
        const sp = Number(editingPrices[p._id] ?? p.sellingPrice ?? 0);
        const cp = Number(editingCosts[p._id] ?? p.costPrice ?? 0);
        return sp <= 0 || cp <= 0;
      }
      if (quickStockFilter === "CHANGED") return isProductChanged(p);
      return true;
    });
    if (!search.trim()) return byFloor;
    return filterAndRankBySearch(byFloor, search, (p) => [
      { text: p.code, weight: 1.5 },
      { text: p.legacyCode, weight: 1.2 },
      { text: p.brandName || p.brand, weight: 1.1 },
      { text: p.versionName, weight: 1.2 },
      { text: p.name, weight: 1.3 },
      { text: p.note, weight: 0.9 },
      { text: p.categoryName, weight: 0.9 },
      { text: p.unit, weight: 0.6 },
      ...(Array.isArray(p.variants)
        ? p.variants.map((v) => ({
          text: `${v.variantCode || variantCodeFor(p.code, v.color, v.size)} ${v.color || ""} ${v.size || ""} size ${v.size || ""}`,
          weight: 1.4,
        }))
        : []),
    ]);
  }, [
    products,
    activeWarehouse,
    showZeroFloorItems,
    importsList,
    search,
    onlyShowScanned,
    scannedCheckCounts,
    brandFilter,
    brandOptions,
    quickStockFilter,
    editingFloor1,
    editingFloor2,
    editingPrices,
    editingCosts,
    isProductChanged,
  ]);

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
    async (rawInput: string) => {
      const rawTrimmed = String(rawInput || "").trim();
      if (!rawTrimmed) return;
      const nowStr = new Date().toLocaleTimeString("vi-VN");
      const pool = allCatalogProducts.length > 0 ? allCatalogProducts : products;

      const findWithRemoteRetry = async (code: string) => {
        const localHit = findProductAndVariantByScannedBarcode(pool, code);
        if (localHit) return localHit;
        // v5.0: tra cứu server theo mã mới / mã con / mã cũ (legacy) / mã rút gọn tem cũ
        try {
          const hit = await lookupProductByCodeApi(code);
          if (hit?.product) {
            const v = hit.variant;
            return {
              product: hit.product,
              matchedVariant: v
                ? {
                  ...v,
                  variantCode: v.variantCode || v.barcode || hit.product.code,
                  stockFloor1: Number(v.stockFloor1 || 0),
                  stockFloor2: Number(v.stockFloor2 || 0),
                  stock: Number(v.stock || 0),
                }
                : undefined,
              isVariantExactMatch: Boolean(v),
            };
          }
        } catch {
          // ignore -> thử tải lại danh mục
        }
        try {
          const freshRes = await apiRequest<Product[]>("/products");
          const freshPool = Array.isArray(freshRes.data) ? freshRes.data : [];
          if (freshPool.length > 0) {
            setAllCatalogProducts(freshPool);
            return findProductAndVariantByScannedBarcode(freshPool, code);
          }
        } catch {
          // ignore network error
        }
        return undefined;
      };

      // Nếu đang mở Popup Nhập Kho Admin -> Quét mã để cộng SL hoặc thêm dòng vào bảng nhập kho
      if (showAdminImportModal) {
        const exactChildIdx = adminImportRows.findIndex(
          (r) =>
            r.productCode &&
            (r.color || r.size) &&
            isScannedCodeMatch(
              rawTrimmed,
              variantCodeFor(r.productCode, r.color, r.size)
            )
        );
        const matchedRowIdx =
          exactChildIdx >= 0
            ? exactChildIdx
            : adminImportRows.findIndex(
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
          const rowCode = variantCodeFor(row.productCode, row.color, row.size);
          playScannerBeep("success");
          setLastScanFeedback({
            type: "success",
            code: rowCode,
            message: `Đã cộng +1 vào dòng #${matchedRowIdx + 1} [${rowCode}] ${row.productName} (SL: ${(Number(row.quantity) || 0) + 1})`,
            time: nowStr,
          });
          return;
        }

        const scanRes = await findWithRemoteRetry(rawTrimmed);
        if (scanRes) {
          const { product, matchedVariant } = scanRes;
          const catId =
            typeof product.categoryId === "object"
              ? product.categoryId?._id || ""
              : String(product.categoryId || "");
          const vColor = matchedVariant?.color || "";
          const vSize = matchedVariant?.size || "";
          const childCode = variantCodeFor(product.code, vColor, vSize);
          setAdminImportRows((prev) => {
            const isSingleBlank =
              prev.length === 1 && !prev[0].productCode.trim() && !prev[0].productName.trim();
            const newRow: AdminImportRow = {
              stt: isSingleBlank ? 1 : prev.length + 1,
              productId: product._id,
              productCode: product.code,
              productName: product.name,
              categoryId: catId || newProdCatId || categories[0]?._id || "",
              brand: product.brand || "",
              color: vColor,
              size: vSize,
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
            code: childCode,
            message: `Đã thêm [${childCode}] ${product.name}${vColor || vSize ? ` (${[vColor, vSize].filter(Boolean).join(" - ")})` : ""
              } vào bảng nhập kho (SL: 1)`,
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

      // Mặc định: Quét kiểm hàng & đối chiếu tồn kho trên tab PRODUCTS (ưu tiên khớp chính xác Mã con thuộc tính)
      const scanRes = await findWithRemoteRetry(rawTrimmed);
      if (!scanRes) {
        playScannerBeep("error");
        setLastScanFeedback({
          type: "error",
          code: cleanBarcodeCode(rawTrimmed),
          message: `Không tìm thấy sản phẩm hoặc mã con "${rawTrimmed}" trong kho.`,
          time: nowStr,
        });
        return;
      }

      const { product, matchedVariant } = scanRes;
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

      if (matchedVariant && (matchedVariant.color || matchedVariant.size)) {
        const childCode =
          matchedVariant.variantCode ||
          variantCodeFor(product.code, matchedVariant.color, matchedVariant.size);
        setLastScannedVariantCode(childCode);
        const prevVarCount = scannedVariantCounts[product._id]?.[childCode] || 0;
        const nextVarCount = prevVarCount + 1;
        setScannedVariantCounts((prev) => ({
          ...prev,
          [product._id]: {
            ...(prev[product._id] || {}),
            [childCode]: nextVarCount,
          },
        }));

        const varF1 = Number(matchedVariant.stockFloor1 || 0);
        const varF2 = Number(matchedVariant.stockFloor2 || 0);
        const varSysStock =
          activeWarehouse === "FLOOR_1"
            ? varF1
            : activeWarehouse === "FLOOR_2"
              ? varF2
              : varF1 + varF2;
        const isOver = varSysStock > 0 && nextVarCount > varSysStock;
        const isExact = varSysStock > 0 && nextVarCount === varSysStock;
        playScannerBeep(isOver ? "warning" : "success");

        const attrDesc = [
          matchedVariant.color,
          matchedVariant.size ? `Size ${matchedVariant.size}` : "",
        ]
          .filter(Boolean)
          .join(" - ");

        setLastScanFeedback({
          type: isOver ? "warning" : "success",
          code: childCode,
          message: `[${childCode}] ${product.name} (${attrDesc}) • Đã quét mã con: ${nextVarCount} / Tồn biến thể (${activeWarehouseLabel}): ${varSysStock} ${product.unit || "Cái"}${isExact ? " (✓ ĐÃ KHỚP ĐỦ)" : isOver ? ` (⚠️ DƯ +${nextVarCount - varSysStock})` : ""
            }`,
          time: nowStr,
        });
        return;
      }

      setLastScannedVariantCode(null);
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
        message: `[${product.code}] ${product.name} • Đã quét kiểm: ${nextCount} / Tồn ${activeWarehouseLabel}: ${sysStock} ${product.unit || "Cái"}${isExact ? " (✓ ĐÃ KHỚP ĐỦ)" : isOver ? ` (⚠️ DƯ +${nextCount - sysStock})` : ""
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
      scannedVariantCounts,
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
            <strong className="text-brand-ink font-mono">{totalItems}</strong>{" "}
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
                className={`w-8 h-8 rounded-lg font-mono font-extrabold text-xs transition ${pNum === page
                  ? "bg-teal-600 text-white shadow"
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
    <div className="space-y-4">
      {/* HEADER GỌN GÀNG: CHỌN KHO TẦNG + THAO TÁC NHANH + 4 TAB CHÍNH */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Quản lý Kho
            </h2>
            {/* Bộ chọn Kho tầng dạng Segmented Control gọn 1 hàng */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleSelectWarehouseTab("FLOOR_1")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 ${
                  activeWarehouse === "FLOOR_1"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Kho Tầng 1</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeWarehouse === "FLOOR_1"
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-700"
                  }`}
                >
                  {totalFloor1Qty.toLocaleString("vi-VN")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectWarehouseTab("FLOOR_2")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 ${
                  activeWarehouse === "FLOOR_2"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Kho Tầng 2</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeWarehouse === "FLOOR_2"
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-700"
                  }`}
                >
                  {totalFloor2Qty.toLocaleString("vi-VN")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectWarehouseTab("ALL")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 ${
                  activeWarehouse === "ALL"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Gộp 2 kho</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeWarehouse === "ALL"
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-700"
                  }`}
                >
                  {(totalFloor1Qty + totalFloor2Qty).toLocaleString("vi-VN")}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingProductModal(null);
                setShowCodeCreator(true);
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo SP mới
            </button>
            <button
              type="button"
              onClick={() => setShowAdminImportModal(true)}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Nhập kho nhanh
            </button>
          </div>
        </div>

        {/* Thanh chuyển 4 Tab gọn gàng (Đã bỏ Điều chỉnh kho & gom toàn bộ Lịch sử vào 1 tab) */}
        <div
          role="tablist"
          aria-label="Phân hệ Quản lý kho"
          className="flex flex-wrap items-center gap-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === "PRODUCTS"}
            onClick={() => setSubTab("PRODUCTS")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
              subTab === "PRODUCTS"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>1. Tồn kho &amp; Giá</span>
            <span
              className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                subTab === "PRODUCTS" ? "bg-white/20 text-white" : "bg-white text-slate-600"
              }`}
            >
              {products.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === "TRANSFER"}
            onClick={() => setSubTab("TRANSFER")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
              subTab === "TRANSFER"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>2. Chuyển tầng (T1 ↔ T2)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === "HISTORY"}
            onClick={() => setSubTab("HISTORY")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
              subTab === "HISTORY"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <History className="w-4 h-4" />
            <span>3. Lịch sử kho</span>
            {importsList.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                  subTab === "HISTORY" ? "bg-white/20 text-white" : "bg-white text-slate-600"
                }`}
              >
                {importsList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === "REPORT"}
            onClick={() => setSubTab("REPORT")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
              subTab === "REPORT"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>4. Báo cáo Nhập-Xuất-Tồn</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
            statusMsg.type === "success"
              ? "bg-teal-50 border-teal-200 text-brand-ink"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="p-1 rounded hover:bg-black/5 cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SUB-TAB 1: SẢN PHẨM, SỐ LƯỢNG, GIÁ GỐC & GIÁ BÁN LẺ */}
      {subTab === "PRODUCTS" && (
        <div className="space-y-6">
          {/* Bảng danh sách sản phẩm: Chia rõ Kho Tầng 1 & Kho Tầng 2 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            {/* Hàng 1: Tiêu đề + Cụm nút tác vụ chính */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex flex-wrap items-center gap-2">
                  <span>Danh mục Sản phẩm — {activeWarehouseLabel}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-teal-100 text-brand-ink">
                    {displayedProducts.length} mặt hàng · {totalStockQty.toLocaleString("vi-VN")} đơn vị
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeWarehouse === "FLOOR_1"
                    ? "Đang xem và chỉnh sửa trực tiếp tồn kho tại Kho Tầng 1. Bấm sang tab 'Kho Tầng 2' ở trên để quản lý riêng Kho Tầng 2."
                    : activeWarehouse === "FLOOR_2"
                      ? "Đang xem và chỉnh sửa trực tiếp tồn kho tại Kho Tầng 2. Có thể bật 'Hiện cả SP ngoài Tầng 2' nếu muốn nhập số lượng Tầng 2 cho các mã hàng khác."
                      : "Đang xem gộp cả 2 kho: có thể chỉnh sửa riêng cột Tồn Kho Tầng 1 và Tồn Kho Tầng 2 trên cùng một dòng."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminImportModal(true)}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
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
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
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
                      ? "bg-teal-600 hover:bg-teal-700 text-white shadow-md ring-2 ring-teal-200 cursor-pointer"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
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
                <button
                  type="button"
                  disabled={displayedProducts.length === 0}
                  onClick={handleOpenPrintLabelsForDisplayed}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  title="In tem nhãn mã vạch"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Tem Label
                </button>
                <ExportExcelButton
                  onExport={() => exportProducts(displayedProducts, { hideCost: !canSeeCost })}
                  disabled={displayedProducts.length === 0}
                />
                <button
                  type="button"
                  onClick={() => setShowScannerPanel((v) => !v)}
                  className={`px-3 py-2 rounded-lg border text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                    showScannerPanel || Object.keys(scannedCheckCounts).length > 0
                      ? "bg-teal-50 border-teal-400 text-teal-900"
                      : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                  title="Bật/tắt khung Máy quét Label kiểm hàng"
                >
                  <ScanBarcode className="w-3.5 h-3.5 text-brand-ink" />
                  <span>
                    Máy quét kiểm kho
                    {Object.keys(scannedCheckCounts).length > 0
                      ? ` (${Object.keys(scannedCheckCounts).length})`
                      : ""}
                  </span>
                </button>
              </div>
            </div>

            {/* Hàng 2: Thanh tìm kiếm + Bộ lọc Category/Brand + Quick Filter Chips */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm mã gốc, mã con, tên, ghi chú..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                >
                  <option value="">Tất cả Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.skuCode ? `[${c.skuCode}] ` : ""}
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Lọc theo thương hiệu"
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                >
                  <option value="">Tất cả Thương hiệu</option>
                  {brandOptions
                    .filter((b) => !categoryId || b.isSystem || (b.categoryIds || []).map(String).includes(categoryId))
                    .map((b) => (
                      <option key={b._id} value={b._id}>
                        [{b.code}] {b.name}
                      </option>
                    ))}
                </select>
                {activeWarehouse !== "ALL" && (
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showZeroFloorItems}
                      onChange={(e) => setShowZeroFloorItems(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Hiện cả SP ngoài {activeWarehouse === "FLOOR_2" ? "Tầng 2" : "Tầng 1"} ({products.length} SP)
                  </label>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "ALL", label: "Tất cả" },
                    { id: "IN_STOCK", label: "Còn hàng (>0)" },
                    { id: "ZERO_STOCK", label: "Hết hàng (=0)" },
                    { id: "MISSING_PRICE", label: "Chưa có giá" },
                    ...(changedProducts.length > 0
                      ? [{ id: "CHANGED" as QuickStockFilter, label: `Đang sửa (${changedProducts.length})` }]
                      : []),
                  ] as { id: QuickStockFilter; label: string }[]
                ).map((chip) => {
                  const active = quickStockFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setQuickStockFilter(chip.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        active
                          ? "bg-teal-600 text-white shadow-2xs"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
                {(search || categoryId || brandFilter || quickStockFilter !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setCategoryId("");
                      setBrandFilter("");
                      setQuickStockFilter("ALL");
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-red-600 hover:bg-red-50 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Xoá lọc
                  </button>
                )}
              </div>
            </div>

            {/* THANH MÁY QUÉT LABEL — QUÉT KIỂM HÀNG & ĐỐI CHIẾU TỒN KHO TRÊN CMS */}
            {(showScannerPanel || Object.keys(scannedCheckCounts).length > 0 || lastScanFeedback) && (
              <div className="rounded-xl border border-teal-300 bg-teal-50/50 p-3 shadow-2xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                      <ScanBarcode className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-teal-950">
                          Máy Quét Label — Kiểm Hàng &amp; Đối Chiếu Tồn Kho
                        </span>
                        <button
                          type="button"
                          onClick={() => setScannerEnabled((v) => !v)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition cursor-pointer ${
                            scannerEnabled ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {scannerEnabled ? "● ĐANG BẬT TỰ ĐỘNG" : "○ ĐÃ TẮT"}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Bắn mã vạch hoặc nhập tay để cộng +1 kiểm đếm và tự động bung dòng biến thể Màu/Size.
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
                        onChange={(e) => setScannerInput(e.target.value)}
                        placeholder="Quét hoặc gõ mã SP + Enter..."
                        className="w-48 sm:w-56 px-3 py-1.5 rounded-lg border border-teal-400 bg-white text-xs font-mono font-bold text-slate-900 uppercase focus:border-teal-600 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold whitespace-nowrap cursor-pointer"
                      >
                        +1 Kiểm
                      </button>
                    </form>

                    {Object.keys(scannedCheckCounts).length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setOnlyShowScanned((v) => !v)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-extrabold transition cursor-pointer ${
                            onlyShowScanned
                              ? "bg-teal-700 text-white border-teal-700"
                              : "bg-white text-brand-ink border-teal-300 hover:bg-teal-50"
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
                            className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác -1
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setScannedCheckCounts({});
                            setScannedVariantCounts({});
                            setLastScannedProdId(null);
                            setLastScannedVariantCode(null);
                            setOnlyShowScanned(false);
                            setLastScanFeedback(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
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
                        ? "bg-teal-100/90 border-teal-300 text-teal-950"
                        : lastScanFeedback.type === "warning"
                          ? "bg-amber-100/90 border-amber-300 text-amber-950"
                          : "bg-red-100/90 border-red-300 text-red-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {lastScanFeedback.type === "error" ? (
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-brand-ink" />
                      )}
                      <span className="truncate">{lastScanFeedback.message}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-75 shrink-0">
                      {lastScanFeedback.time}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Sản phẩm</th>
                    <th className="py-3 px-3 w-36">Category</th>
                    <th className="py-3 px-3 w-36">Thương hiệu</th>
                    {(activeWarehouse === "FLOOR_1" || activeWarehouse === "ALL") && (
                      <th className="py-3 px-3 text-center w-28 whitespace-nowrap text-brand-ink">
                        Tồn Tầng 1
                      </th>
                    )}
                    {(activeWarehouse === "FLOOR_2" || activeWarehouse === "ALL") && (
                      <th className="py-3 px-3 text-center w-28 whitespace-nowrap text-purple-700">
                        Tồn Tầng 2
                      </th>
                    )}
                    {activeWarehouse === "ALL" && (
                      <th className="py-3 px-3 text-center w-28 whitespace-nowrap text-slate-700">
                        Tổng 2 Kho
                      </th>
                    )}
                    <th className="py-3 px-3 text-right w-36 whitespace-nowrap">Giá vốn (VND)</th>
                    <th className="py-3 px-3 text-right w-36 whitespace-nowrap">Giá niêm yết (VND)</th>
                    <th className="py-3 px-3 text-right w-32 whitespace-nowrap">Lãi / SP</th>
                    <th className="py-3 px-4 text-right w-32 whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
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
                    const catName =
                      categories.find((c) => c._id === catVal)?.name ||
                      (typeof p.categoryId === "object" ? p.categoryId?.name : "") ||
                      "Chưa phân loại";
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
                    const marginPct = costVal > 0 ? Math.round((margin / costVal) * 100) : 0;
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
                    const previewVars = isVarExpanded ? namedVars : namedVars.slice(0, 4);
                    const hiddenVarCount = Math.max(0, namedVars.length - previewVars.length);
                    return (
                      <React.Fragment key={p._id}>
                        <tr
                          className={`bg-white hover:bg-teal-50/70 transition-colors ${lastScannedProdId === p._id
                            ? "bg-teal-50/90 ring-2 ring-inset ring-teal-500"
                            : scannedQty > 0
                              ? "bg-teal-50/40"
                              : ""
                            }`}
                        >
                          {/* 1. SẢN PHẨM */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                              <span className="font-semibold text-slate-400">
                                {String(rowStt).padStart(2, "0")}
                              </span>
                              <span className="font-semibold text-slate-500">{p.code}</span>
                              {(p.brandName || p.brand || p.versionName) && (
                                <span className="font-sans text-[10px] text-slate-400">
                                  · {p.brandName || p.brand || ""}
                                  {p.versionName ? ` ${p.versionName}` : ""}
                                </span>
                              )}
                              {scannedQty > 0 && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${scannedQty === activeQty
                                    ? "bg-teal-600 text-white border-teal-700"
                                    : scannedQty > activeQty
                                      ? "bg-amber-500 text-white border-amber-600"
                                      : "bg-teal-100 text-teal-900 border-teal-300"
                                    }`}
                                >
                                  Quét: {scannedQty}/{activeQty}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenPrintLabelForProduct(p)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold text-slate-500 hover:text-brand-ink hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition cursor-pointer"
                                title="In tem nhãn mã vạch theo từng Mã con (Màu + Size)"
                              >
                                <Printer className="w-3 h-3" /> In mã
                              </button>
                            </div>

                            <div className="mt-1 font-bold text-slate-900 text-[13px] leading-snug">
                              {nameVal}
                            </div>
                            {(editingNotes[p._id] ?? p.note) && (
                              <div className="mt-0.5 text-[11px] text-slate-400 truncate max-w-md">
                                {editingNotes[p._id] ?? p.note}
                              </div>
                            )}

                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {previewVars.length > 0 ? (
                                previewVars.map((v, vIdx) => {
                                  const cLabel = (v.color || "").trim() || "Mặc định";
                                  const sLabel = (v.size || "").trim();
                                  const vQty =
                                    activeWarehouse === "FLOOR_2"
                                      ? v.stockFloor2 || 0
                                      : activeWarehouse === "FLOOR_1"
                                        ? v.stockFloor1 || 0
                                        : (v.stockFloor1 || 0) + (v.stockFloor2 || 0);
                                  const vHexes = resolveVariantColorHexes(
                                    cLabel,
                                    Array.isArray(v.colorHexes) && v.colorHexes.length > 0
                                      ? v.colorHexes
                                      : undefined
                                  );
                                  const childCode =
                                    v.variantCode || variantCodeFor(p.code, v.color, v.size);
                                  return (
                                    <button
                                      key={`${cLabel}-${sLabel}-${vIdx}`}
                                      type="button"
                                      onClick={() =>
                                        setExpandedVariantProdId(isVarExpanded ? null : p._id)
                                      }
                                      title={`Mã con: ${childCode} · Bấm để quản lý Size/Màu`}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold transition cursor-pointer ${lastScannedVariantCode === childCode
                                        ? "bg-teal-600 text-white border-teal-700"
                                        : "bg-slate-50 hover:bg-teal-50 hover:border-teal-400 text-slate-700 hover:text-teal-900 border-slate-200"
                                        }`}
                                    >
                                      <ColorSwatchBadge
                                        hexes={vHexes}
                                        colorName={cLabel}
                                        size="xs"
                                      />
                                      <span>
                                        {cLabel}
                                        {sLabel ? ` · ${sLabel}` : ""} ({vQty})
                                      </span>
                                    </button>
                                  );
                                })
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedVariantProdId(isVarExpanded ? null : p._id)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-dashed border-slate-300 bg-white hover:border-teal-400 hover:text-brand-ink text-slate-500 text-[11px] font-semibold transition cursor-pointer"
                                >
                                  + Thêm size/màu
                                </button>
                              )}
                              {hiddenVarCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedVariantProdId(isVarExpanded ? null : p._id)
                                  }
                                  className="px-2 py-0.5 rounded-full bg-indigo-50 text-brand-ink border border-indigo-200 text-[11px] font-bold hover:bg-indigo-100 cursor-pointer"
                                >
                                  +{hiddenVarCount} nữa
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedVariantProdId(isVarExpanded ? null : p._id)
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-dashed text-[11px] font-semibold transition cursor-pointer ${isVarExpanded
                                  ? "bg-teal-600 text-white border-teal-700"
                                  : "bg-white hover:bg-teal-50 hover:border-teal-500 hover:text-brand-ink text-slate-600 border-slate-300"
                                  }`}
                              >
                                + Thêm
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenSetLinkModal(p)}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold transition cursor-pointer ${(p.parentSetProductId && (p.packSize || 0) > 0) ||
                                  (Array.isArray(p.linkedRetailProducts) &&
                                    p.linkedRetailProducts.length > 0)
                                  ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
                                  : "bg-white hover:bg-teal-50 hover:border-teal-400 hover:text-brand-ink text-slate-600 border-slate-200"
                                  }`}
                                title="Cấu hình liên kết tự động tách từ Sản phẩm Bộ/Hộp sang Sản phẩm Lẻ"
                              >
                                {p.parentSetProductId && (p.packSize || 0) > 0
                                  ? `SP Lẻ (1 ${p.parentSetUnit || "Bộ"} = ${p.packSize} ${p.unit})`
                                  : Array.isArray(p.linkedRetailProducts) &&
                                    p.linkedRetailProducts.length > 0
                                    ? `SP Bộ (${p.linkedRetailProducts.length} SP lẻ)`
                                    : "Gắn Bộ ↔ Lẻ"}
                              </button>
                            </div>

                            {/* Giữ nút Tách 1 Bộ nhanh nếu đã liên kết Bộ <-> Lẻ */}
                            {p.parentSetProductId && (p.packSize || 0) > 0 && (
                              <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-amber-50/80 border border-amber-200 inline-flex flex-wrap items-center gap-2 text-[10px]">
                                <span className="text-amber-950 font-semibold">
                                  Bộ:{" "}
                                  <strong className="font-mono">
                                    {p.parentSetProductCode || "SP Bộ"}
                                  </strong>{" "}
                                  (Tồn T1: {p.parentSetStockFloor1 ?? 0})
                                </span>
                                <button
                                  type="button"
                                  disabled={unpackingLoadingId === p._id}
                                  onClick={() => handleQuickUnpackSet(p._id, 1)}
                                  className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold text-[10px] cursor-pointer"
                                >
                                  {unpackingLoadingId === p._id
                                    ? "Đang tách..."
                                    : `⚡ Tách 1 ${p.parentSetUnit || "Bộ"} → +${p.packSize} ${p.unit}`}
                                </button>
                              </div>
                            )}
                            {Array.isArray(p.linkedRetailProducts) &&
                              p.linkedRetailProducts.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {p.linkedRetailProducts.map((ret) => (
                                    <div
                                      key={ret._id}
                                      className="px-2.5 py-1 rounded-lg bg-teal-50/80 border border-teal-200 inline-flex items-center gap-2 text-[10px]"
                                    >
                                      <span className="text-teal-950 font-semibold">
                                        Bóc lẻ{" "}
                                        <strong className="font-mono">{ret.code}</strong> (Tồn T1:{" "}
                                        {ret.stockFloor1})
                                      </span>
                                      <button
                                        type="button"
                                        disabled={unpackingLoadingId === ret._id}
                                        onClick={() => handleQuickUnpackSet(ret._id, 1)}
                                        className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold text-[10px] cursor-pointer"
                                      >
                                        {unpackingLoadingId === ret._id
                                          ? "Đang tách..."
                                          : `⚡ Tách 1 ${p.unit} → +${ret.packSize} ${ret.unit}`}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                          </td>

                          {/* 2. CATEGORY */}
                          <td className="py-3.5 px-3 align-top">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-teal-50 text-brand-ink font-semibold text-[11px] whitespace-nowrap">
                              {catName}
                            </span>
                          </td>

                          {/* 2b. THƯƠNG HIỆU */}
                          <td className="py-3.5 px-3 align-top">
                            {(p.brandName || p.brand) ? (
                              <div>
                                <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px] whitespace-nowrap">
                                  {p.brandName || p.brand}
                                </span>
                                {p.versionName && (
                                  <div className="mt-0.5 text-[10px] text-slate-400 whitespace-nowrap">
                                    {p.versionName}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>

                          {/* 3. TỒN TẦNG 1 */}
                          {(activeWarehouse === "FLOOR_1" || activeWarehouse === "ALL") && (
                            <td className="py-3.5 px-3 text-center align-top">
                              <div className="text-lg font-black text-slate-900 tabular-nums">
                                {formatNumberDots(f1Val)}
                              </div>
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${f1Val > 0
                                  ? "bg-teal-50 text-brand-ink"
                                  : "bg-slate-100 text-slate-500"
                                  }`}
                              >
                                {f1Val > 0 ? "Còn hàng" : "Hết hàng"}
                              </span>
                            </td>
                          )}

                          {/* 4. TỒN TẦNG 2 */}
                          {(activeWarehouse === "FLOOR_2" || activeWarehouse === "ALL") && (
                            <td className="py-3.5 px-3 text-center align-top">
                              <div className="text-lg font-black text-slate-900 tabular-nums">
                                {formatNumberDots(f2Val)}
                              </div>
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${f2Val > 0
                                  ? "bg-teal-50 text-brand-ink"
                                  : "bg-slate-100 text-slate-500"
                                  }`}
                              >
                                {f2Val > 0 ? "Còn hàng" : "Hết hàng"}
                              </span>
                            </td>
                          )}

                          {/* TỔNG 2 KHO (khi chọn Gộp 2 kho) */}
                          {activeWarehouse === "ALL" && (
                            <td className="py-3.5 px-3 text-center align-top">
                              <div className="text-lg font-black text-slate-900 tabular-nums">
                                {formatNumberDots(f1Val + f2Val)}
                              </div>
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${f1Val + f2Val > 0
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-slate-100 text-slate-400"
                                  }`}
                              >
                                Tổng
                              </span>
                            </td>
                          )}

                          {/* 5. GIÁ VỐN (VND) */}
                          <td className="py-3.5 px-3 text-right align-top">
                            <div className="text-[15px] font-black text-slate-900 tabular-nums">
                              {formatNumberDots(costVal)}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                              Tổng: <strong className="text-slate-900">{formatNumberDots(activeQty * costVal)}</strong>
                            </div>
                          </td>

                          {/* 6. GIÁ NIÊM YẾT (VND) */}
                          <td className="py-3.5 px-3 text-right align-top">
                            <div className="text-[15px] font-black text-slate-900 tabular-nums">
                              {formatNumberDots(sellVal)}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 whitespace-nowrap">
                              Niêm yết
                            </div>
                          </td>

                          {/* 7. LÃI / SP */}
                          <td className="py-3.5 px-3 text-right align-top">
                            {sellVal > 0 ? (
                              <>
                                <div
                                  className={`text-[15px] font-black tabular-nums whitespace-nowrap ${margin < 0 ? "text-red-600" : "text-slate-900"
                                    }`}
                                >
                                  {margin >= 0
                                    ? `+${formatNumberDots(margin)}`
                                    : `-${formatNumberDots(Math.abs(margin))}`}
                                </div>
                                <div className="mt-0.5 text-xs text-slate-500 whitespace-nowrap">
                                  {costVal > 0 ? `${marginPct}% / SP` : "Chưa có vốn"}
                                </div>
                              </>
                            ) : (
                              <div className="text-xs text-slate-400">—</div>
                            )}
                          </td>

                          {/* 8. THAO TÁC */}
                          <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {isProductChanged(p) && (
                                <>
                                  <button
                                    type="button"
                                    disabled={savingBatch}
                                    onClick={() => handleSaveSingleProductRow(p)}
                                    className="px-2 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-extrabold inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                                    title="Lưu riêng dòng sản phẩm này"
                                  >
                                    <Save className="w-3 h-3" /> Lưu
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingBatch}
                                    onClick={() => handleResetSingleProductRow(p)}
                                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 inline-flex items-center justify-center cursor-pointer"
                                    title="Hoàn tác dòng này"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingProductModal(p)}
                                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-teal-100 hover:border-teal-400 text-brand-ink inline-flex items-center justify-center transition cursor-pointer"
                                title="Sửa thông tin sản phẩm, giá và biến thể"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
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
                                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-200 hover:border-slate-400 text-slate-700 inline-flex items-center justify-center transition cursor-pointer"
                                title="Chuyển tầng (T1 ↔ T2)"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p)}
                                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-red-100 hover:border-red-300 text-red-500 hover:text-red-700 inline-flex items-center justify-center transition cursor-pointer"
                                title="Xóa sản phẩm"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isVarExpanded && (
                          <tr className="bg-indigo-50/40">
                            <td colSpan={activeWarehouse === "ALL" ? 10 : 8} className="p-3.5">
                              <div className="bg-white rounded-xl border-2 border-indigo-200 p-3.5 space-y-3 shadow-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-extrabold text-indigo-950">
                                      🎨 Quản lý Chi tiết Màu sắc • Size • Mã con cho Mã gốc:{" "}
                                      <span className="font-mono text-brand-ink">{p.code}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      Mỗi thuộc tính (Màu + Size) có <b>Mã con riêng</b> để in tem &amp; quét kiểm kho chính xác, dùng chung Giá vốn ({formatVND(costVal)}) và Giá niêm yết ({formatVND(sellVal)}).
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

                                {/* Thanh lọc nhanh theo Màu sắc & Tìm kiếm Size/Mã con khi có nhiều biến thể */}
                                {prodVariants.length > 3 && (() => {
                                  const colorMap = new Map<string, number>();
                                  prodVariants.forEach((v) => {
                                    const c = (v.color || "").trim() || "Mặc định";
                                    colorMap.set(c, (colorMap.get(c) || 0) + 1);
                                  });
                                  const colorEntries = Array.from(colorMap.entries());
                                  return (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-slate-500 mr-1">
                                          Lọc theo màu:
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setCmsVarColorFilter("ALL")}
                                          className={`px-2 py-0.5 rounded text-[11px] font-extrabold border transition ${cmsVarColorFilter === "ALL"
                                            ? "bg-teal-600 text-white border-slate-900"
                                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                                            }`}
                                        >
                                          Tất cả ({prodVariants.length})
                                        </button>
                                        {colorEntries.map(([cName, cnt]) => {
                                          const explicitHexes = prodVariants.find(
                                            (v) =>
                                              ((v.color || "").trim() || "Mặc định") === cName &&
                                              Array.isArray(v.colorHexes) &&
                                              v.colorHexes.length > 0
                                          )?.colorHexes;
                                          const cHexes = resolveVariantColorHexes(
                                            cName,
                                            explicitHexes
                                          );
                                          const isSelectedTab = cmsVarColorFilter === cName;
                                          return (
                                            <button
                                              key={cName}
                                              type="button"
                                              onClick={() => setCmsVarColorFilter(cName)}
                                              style={
                                                !isSelectedTab
                                                  ? getColorBoxBorderStyle(cHexes, "#ffffff", 2)
                                                  : undefined
                                              }
                                              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition inline-flex items-center gap-1.5 ${isSelectedTab
                                                ? "bg-indigo-600 text-white border-indigo-700"
                                                : "bg-white text-slate-800 border-slate-300 hover:bg-indigo-50"
                                                }`}
                                            >
                                              <ColorSwatchBadge
                                                hexes={cHexes}
                                                colorName={cName}
                                                size="xs"
                                              />
                                              <span>
                                                {cName} ({cnt})
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                      <div className="relative w-full sm:w-52 shrink-0">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                                        <input
                                          type="text"
                                          value={cmsVarSearch}
                                          onChange={(e) => setCmsVarSearch(e.target.value)}
                                          placeholder="Tìm mã con, màu, size..."
                                          className="w-full pl-8 pr-2.5 py-1 rounded border border-slate-300 bg-white text-xs focus:border-indigo-600 focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}

                                <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-200 rounded-lg">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[10px] sticky top-0 z-10">
                                      <tr>
                                        <th className="py-2 px-2.5 w-10 text-center">#</th>
                                        <th className="py-2 px-2.5">Mã con</th>
                                        <th className="py-2 px-2.5">Màu sắc</th>
                                        <th className="py-2 px-2.5">Size</th>
                                        <th className="py-2 px-2.5 text-right">🏢 Tồn Kho Tầng 1</th>
                                        <th className="py-2 px-2.5 text-right">🏬 Tồn Kho Tầng 2</th>
                                        <th className="py-2 px-2.5 text-right">Tổng SL</th>
                                        <th className="py-2 px-2.5 text-right" title="Trống/0 = dùng giá niêm yết gốc">Giá niêm yết</th>
                                        {canSeeCost && (
                                          <th className="py-2 px-2.5 text-right" title="Trống/0 = dùng giá vốn gốc">Giá vốn</th>
                                        )}
                                        <th className="py-2 px-2.5 text-center">In tem</th>
                                        <th className="py-2 px-2.5 text-center w-16">Xóa</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                      {prodVariants.length === 0 ? (
                                        <tr>
                                          <td colSpan={canSeeCost ? 11 : 10} className="py-3 text-center text-slate-400">
                                            Chưa có phân loại Size/Màu. Hãy thêm ở dòng bên dưới.
                                          </td>
                                        </tr>
                                      ) : (
                                        prodVariants
                                          .map((v, vIdx) => ({ v, vIdx }))
                                          .filter(({ v }) => {
                                            const c = (v.color || "").trim() || "Mặc định";
                                            if (cmsVarColorFilter !== "ALL" && c !== cmsVarColorFilter) {
                                              return false;
                                            }
                                            const q = cmsVarSearch.trim().toLowerCase();
                                            if (!q) return true;
                                            const childCode = variantCodeFor(
                                              p.code,
                                              v.color,
                                              v.size
                                            );
                                            return `${c} ${v.size || ""} ${childCode}`
                                              .toLowerCase()
                                              .includes(q);
                                          })
                                          .map(({ v, vIdx }) => {
                                            const childCode = variantCodeFor(
                                              p.code,
                                              v.color,
                                              v.size
                                            );
                                            const vScanned =
                                              scannedVariantCounts[p._id]?.[childCode] || 0;
                                            return (
                                              <tr
                                                key={vIdx}
                                                className={`hover:bg-slate-50 ${lastScannedVariantCode === childCode
                                                  ? "bg-teal-50"
                                                  : ""
                                                  }`}
                                              >
                                                <td className="py-1.5 px-2.5 text-center font-mono text-slate-400">
                                                  {vIdx + 1}
                                                </td>
                                                <td className="py-1.5 px-2.5">
                                                  <span className="font-mono font-extrabold text-brand-ink bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                                    {childCode}
                                                  </span>
                                                  {vScanned > 0 && (
                                                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-teal-600 text-white font-mono text-[10px] font-bold">
                                                      Quét: {vScanned}
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-1.5 px-2.5">
                                                  <ColorInputWithPicker
                                                    compact
                                                    listId="cms-color-suggestions"
                                                    value={v.color}
                                                    colorHexes={v.colorHexes}
                                                    onChange={(nextColor, nextHexes) => {
                                                      const next = prodVariants.map((item, idx) => {
                                                        if (idx === vIdx) {
                                                          return {
                                                            ...item,
                                                            color: nextColor,
                                                            colorHexes: nextHexes,
                                                          };
                                                        }
                                                        const cleanC = String(nextColor || "")
                                                          .trim()
                                                          .toLowerCase();
                                                        if (
                                                          cleanC &&
                                                          nextHexes.length > 0 &&
                                                          String(item.color || "")
                                                            .trim()
                                                            .toLowerCase() === cleanC
                                                        ) {
                                                          return { ...item, colorHexes: nextHexes };
                                                        }
                                                        return item;
                                                      });
                                                      setEditingVariants((prev) => ({
                                                        ...prev,
                                                        [p._id]: next,
                                                      }));
                                                    }}
                                                    placeholder="VD: Đỏ, Trắng..."
                                                    className="w-44"
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
                                                    className="w-24 px-2 py-1 rounded border border-teal-300 font-mono font-bold text-right text-brand-ink"
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
                                                <td className="py-1.5 px-2.5 text-right">
                                                  <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    aria-label={`Giá niêm yết riêng ${childCode}`}
                                                    disabled={!v.variantKey && !v.variantCode}
                                                    defaultValue={Number(v.sellingPrice || 0) > 0 ? formatNumberDots(Number(v.sellingPrice)) : ""}
                                                    key={`sp_${p._id}_${vIdx}_${v.sellingPrice || 0}`}
                                                    placeholder={formatNumberDots(sellVal)}
                                                    onBlur={(e) => handleSaveVariantPrice(p, v, "sellingPrice", parseNumberDots(e.target.value))}
                                                    className="w-28 px-2 py-1 rounded border border-slate-300 font-mono text-right disabled:bg-slate-100"
                                                    title="Giá niêm yết riêng của biến thể — để trống = dùng giá niêm yết gốc (R8). Rời ô để lưu."
                                                  />
                                                </td>
                                                {canSeeCost && (
                                                  <td className="py-1.5 px-2.5 text-right">
                                                    <input
                                                      type="text"
                                                      inputMode="numeric"
                                                      aria-label={`Giá vốn riêng ${childCode}`}
                                                      disabled={!v.variantKey && !v.variantCode}
                                                      defaultValue={Number(v.costPrice || 0) > 0 ? formatNumberDots(Number(v.costPrice)) : ""}
                                                      key={`cp_${p._id}_${vIdx}_${v.costPrice || 0}`}
                                                      placeholder={formatNumberDots(costVal)}
                                                      onBlur={(e) => handleSaveVariantPrice(p, v, "costPrice", parseNumberDots(e.target.value))}
                                                      className="w-28 px-2 py-1 rounded border border-slate-300 font-mono text-right disabled:bg-slate-100"
                                                      title="Giá vốn riêng của biến thể — để trống = dùng giá vốn gốc. Rời ô để lưu."
                                                    />
                                                  </td>
                                                )}
                                                <td className="py-1.5 px-2.5 text-center">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenPrintLabelForProduct(p, v)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-brand-ink border border-indigo-200 text-[10px] font-bold"
                                                    title={`In tem mã con ${childCode}`}
                                                  >
                                                    <Printer className="w-3 h-3" /> In tem
                                                  </button>
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
                                            );
                                          })
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Dòng thêm nhanh Size / Màu mới */}
                                <div className="flex flex-wrap items-end gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                      + Màu sắc mới (Chọn 1 hoặc nhiều màu)
                                    </label>
                                    <ColorInputWithPicker
                                      listId="cms-color-suggestions"
                                      value={newVarDraft.color}
                                      colorHexes={newVarDraft.colorHexes}
                                      onChange={(nextColor, nextHexes) =>
                                        setNewVariantInputs((prev) => ({
                                          ...prev,
                                          [p._id]: {
                                            ...newVarDraft,
                                            color: nextColor,
                                            colorHexes: nextHexes,
                                          },
                                        }))
                                      }
                                      placeholder="VD: Xanh, Đen..."
                                      className="w-48"
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
                                    <label className="block text-[10px] font-bold text-brand-ink mb-0.5">
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
                                      className="w-24 px-2.5 py-1.5 rounded border border-teal-300 text-xs font-mono font-bold text-right bg-white"
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
                                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center gap-1"
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
                        <td className="py-3 px-2.5 text-right font-mono text-brand-ink">
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
                      <td className="py-3 px-2.5 text-right font-mono text-brand-ink whitespace-nowrap">
                        {formatVND(totalSellInventoryValue)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {changedProducts.length > 0 && (
              <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white text-slate-900 shadow-xl border-2 border-teal-300">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-extrabold font-mono">
                    {changedProducts.length} SP
                  </span>
                  <span className="text-slate-700">
                    đang có thay đổi số lượng tồn kho / giá chưa lưu. Bấm <strong>Lưu thay đổi</strong> để cập nhật toàn bộ cùng lúc.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetProductEdits}
                    disabled={savingBatch}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Hoàn tác
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAllProductChanges}
                    disabled={changedProducts.length === 0 || savingBatch}
                    className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs"
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
                Báo cáo Kế toán Tồn kho theo kỳ — Số lượng, Giá vốn & Giá niêm yết (BR-06)
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
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold"
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
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-3 px-3">Mã sản phẩm</th>
                  <th className="py-3 px-3">Tên sản phẩm</th>
                  <th className="py-3 px-2.5 text-center">ĐVT</th>
                  <th className="py-3 px-2.5 text-right">Đầu Kỳ</th>
                  <th className="py-3 px-2.5 text-right text-teal-300">+ Nhập</th>
                  <th className="py-3 px-2.5 text-right text-amber-300">− Bán</th>
                  <th className="py-3 px-2.5 text-right text-teal-300">± Đ.Chỉnh</th>
                  <th className="py-3 px-2.5 text-right text-teal-300 bg-slate-800 whitespace-nowrap">
                    🏢 Tồn Tầng 1
                  </th>
                  <th className="py-3 px-2.5 text-right text-teal-300 bg-slate-800 whitespace-nowrap">
                    🏬 Tồn Tầng 2
                  </th>
                  <th className="py-3 px-3 text-right font-extrabold bg-slate-200/70 text-slate-900 whitespace-nowrap">
                    = Tổng 2 Kho
                  </th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá vốn (VND)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá niêm yết (VND)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap bg-amber-50 text-amber-800">
                    Tổng vốn tồn
                  </th>
                  <th className="py-3 px-3 text-right whitespace-nowrap bg-teal-50 text-brand-ink">
                    Tổng giá niêm yết tồn
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
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-brand-ink">
                        +{r.importedQty}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-amber-700">
                        -{r.soldQty}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-brand-ink">
                        {r.adjustedAndReturnedQty > 0
                          ? `+${r.adjustedAndReturnedQty}`
                          : r.adjustedAndReturnedQty}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-brand-ink bg-teal-50/40">
                        {f1}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-brand-ink bg-teal-50/40">
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
                      <td className="py-3 px-3 text-right font-mono font-semibold text-brand-ink bg-teal-50/40 whitespace-nowrap">
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
                    <td className="py-3 px-2.5 text-right font-mono text-brand-ink">
                      +{reportRows.reduce((s, r) => s + (Number(r.importedQty) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-amber-700">
                      -{reportRows.reduce((s, r) => s + (Number(r.soldQty) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-brand-ink">
                      {reportRows.reduce((s, r) => s + (Number(r.adjustedAndReturnedQty) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-brand-ink">
                      {reportRows.reduce((s, r) => s + (Number(r.stockFloor1 ?? r.closingStock) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-brand-ink">
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
                    <td className="py-3 px-3 text-right font-mono text-brand-ink whitespace-nowrap">
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

      {/* SUB-TAB 3: LỊCH SỬ KHO (GOM PHIẾU NHẬP KHO + SỔ XUẤT NHẬP TỒN + LỊCH SỬ CHUYỂN TẦNG) */}
      {subTab === "HISTORY" && (
        <div className="space-y-4">
          {/* Thanh chuyển 3 góc nhìn Lịch sử kho */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setHistoryView("IMPORTS")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                  historyView === "IMPORTS"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Phiếu nhập kho</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    historyView === "IMPORTS" ? "bg-white/20 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {filteredImports.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryView("MOVEMENTS")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                  historyView === "MOVEMENTS"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Sổ xuất nhập tồn</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    historyView === "MOVEMENTS" ? "bg-white/20 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {filteredMovements.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryView("TRANSFERS")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                  historyView === "TRANSFERS"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Lịch sử chuyển tầng (PXK)</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    historyView === "TRANSFERS" ? "bg-white/20 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {new Set(transfersList.map((m) => m.referenceCode || m._id)).size}
                </span>
              </button>
            </div>

            <span className="text-xs text-slate-500">
              Đang lọc theo: <strong className="text-brand-ink">{activeWarehouseLabel}</strong>
            </span>
          </div>

          {/* GÓC NHÌN 2: SỔ XUẤT NHẬP TỒN (STOCK MOVEMENTS) */}
          {historyView === "MOVEMENTS" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Sổ Xuất Nhập Tồn —{" "}
                {activeWarehouse === "FLOOR_1"
                  ? "🏢 Kho Tầng 1"
                  : activeWarehouse === "FLOOR_2"
                    ? "🏬 Kho Tầng 2"
                    : "📊 Cả 2 Kho"}
              </h3>
              <p className="text-xs text-slate-500">
                Lưu vết toàn bộ lịch sử biến động tồn kho kèm Kho tầng, Số lượng, Giá vốn, Giá niêm yết, mã chứng từ và nhân viên thực hiện.
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
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3">Kho tầng</th>
                  <th className="py-3 px-3">Loại</th>
                  <th className="py-3 px-3">Sản phẩm</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">SL Biến động</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">SL Tồn sau GD</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá vốn (VND)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá niêm yết (VND)</th>
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
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${loc === "FLOOR_2"
                            ? "bg-teal-100 text-brand-ink"
                            : "bg-teal-100 text-brand-ink"
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
                        className={`py-2.5 px-3 text-right font-mono font-extrabold ${m.quantityChange > 0 ? "text-brand-ink" : "text-red-600"
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
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-ink whitespace-nowrap">
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
                      <td className="py-2.5 px-3 font-mono font-semibold text-brand-ink whitespace-nowrap">
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

      {/* GÓC NHÌN 1: DANH SÁCH PHIẾU NHẬP KHO */}
      {historyView === "IMPORTS" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Lịch sử Phiếu Nhập Kho —{" "}
                {activeWarehouse === "FLOOR_1"
                  ? "🏢 Kho Tầng 1"
                  : activeWarehouse === "FLOOR_2"
                    ? "🏬 Kho Tầng 2"
                    : "📊 Cả 2 Kho"}
              </h3>
              <p className="text-xs text-slate-500">
                Bấm vào dòng phiếu hoặc nút <strong>Chi tiết</strong> để xem đầy đủ từng biến thể (Màu • Size • Mã con), Số lượng, Giá vốn và Người thực hiện.
              </p>
            </div>
            <ExportExcelButton
              label="Xuất Excel"
              onExport={() => exportImports(importsList)}
              disabled={importsList.length === 0}
            />
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-3 px-3">Mã Phiếu</th>
                  <th className="py-3 px-3">Kho nhận</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-3 text-right">Số dòng</th>
                  <th className="py-3 px-3 text-right">Tổng SL thực nhận</th>
                  <th className="py-3 px-3 text-right">Tổng giá vốn</th>
                  <th className="py-3 px-3 text-right">Tổng theo giá niêm yết</th>
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
                    const sellPrice = Number(it.sellingPrice || p?.sellingPrice || 0);
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
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${wh === "FLOOR_2"
                              ? "bg-teal-100 text-brand-ink"
                              : "bg-teal-100 text-brand-ink"
                              }`}
                          >
                            {wh === "FLOOR_2" ? "🏬 Kho Tầng 2" : "🏢 Kho Tầng 1"}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${imp.status === "COMPLETED"
                              ? "bg-teal-100 text-brand-ink"
                              : imp.status === "CHECKING"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-teal-100 text-brand-ink"
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
                        <td className="py-3 px-3 text-right font-mono font-bold text-brand-ink whitespace-nowrap">
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
                              className="px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-brand-ink font-bold text-[11px] inline-flex items-center gap-1"
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
                                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                                  <tr>
                                    <th className="py-2 px-2.5 text-center">STT</th>
                                    <th className="py-2 px-2.5">Mã hàng</th>
                                    <th className="py-2 px-2.5">Tên sản phẩm</th>
                                    <th className="py-2 px-2.5 text-center">ĐVT</th>
                                    <th className="py-2 px-2.5 text-right">SL Dự kiến</th>
                                    <th className="py-2 px-2.5 text-right">SL Thực nhận</th>
                                    <th className="py-2 px-2.5 text-right">Giá vốn (VND)</th>
                                    <th className="py-2 px-2.5 text-right">Giá niêm yết</th>
                                    <th className="py-2 px-2.5 text-right">Thành tiền (Giá vốn)</th>
                                    <th className="py-2 px-2.5">Người kiểm dòng</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {items.map((it: any, idx: number) => {
                                    const prod = productByCode.get(it.productCode);
                                    const qty = Number(it.actualQuantity ?? it.expectedQuantity) || 0;
                                    const cost = Number(it.costPrice || prod?.costPrice || 0);
                                    const sell = Number(it.sellingPrice || prod?.sellingPrice || 0);
                                    const varLabel = [it.color, it.size].filter(Boolean).join(" · ");
                                    return (
                                      <tr key={idx}>
                                        <td className="py-1.5 px-2.5 text-center font-mono">
                                          {it.stt || idx + 1}
                                        </td>
                                        <td className="py-1.5 px-2.5 font-mono font-bold">
                                          <div>{it.variantCode || it.productCode}</div>
                                          {it.variantCode && it.variantCode !== it.productCode && (
                                            <div className="text-[10px] font-normal text-slate-400">
                                              Gốc: {it.productCode}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-1.5 px-2.5 font-semibold">
                                          <div>{it.productName}</div>
                                          {varLabel && (
                                            <div className="text-[10px] font-bold text-brand-ink">
                                              {varLabel}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">{it.unit}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono">
                                          {it.expectedQuantity}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-extrabold text-brand-ink">
                                          {qty}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono text-amber-800">
                                          {formatVND(cost)}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-brand-ink">
                                          {sell > 0 ? formatVND(sell) : "Chưa đặt (0 VND)"}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold">
                                          {formatVND(qty * cost)}
                                        </td>
                                        <td className="py-1.5 px-2.5 whitespace-nowrap">
                                          {Array.isArray(it.scanCounts) && it.scanCounts.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {it.scanCounts.map((sc: any, sIdx: number) => (
                                                <span key={sIdx} className="inline-flex items-center gap-1">
                                                  <span>
                                                    {sc.name} ({sc.quantity})
                                                  </span>
                                                  <CmsRoleBadge role={sc.role} compact />
                                                </span>
                                              ))}
                                            </div>
                                          ) : it.checkedByName ? (
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

          {/* GÓC NHÌN 3: LỊCH SỬ PHIẾU XUẤT KHO CHUYỂN TẦNG (PXK) */}
          {historyView === "TRANSFERS" && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Lịch sử Phiếu Xuất Kho Chuyển Tầng (PXK)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mỗi phiếu xuất kho chuyển tầng (<code>PXK-...</code>) gom nhiều sản phẩm / màu sắc. Bấm vào dòng phiếu để xem chi tiết.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubTab("TRANSFER")}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-brand-ink border border-indigo-200 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Tạo phiếu chuyển tầng mới
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
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
                              <td className="py-3 px-3 font-mono font-extrabold text-brand-ink">
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
                              <td className="py-3 px-3 font-bold text-brand-ink whitespace-nowrap">
                                {first.toWarehouse === "FLOOR_2"
                                  ? "🏬 Kho Tầng 2"
                                  : "🏢 Kho Tầng 1"}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold">
                                {items.length} SP
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-extrabold text-brand-ink">
                                {totalQty}
                              </td>
                              <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                                {first.performedByName || "Quản trị viên"}
                              </td>
                              <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                                {first.note || "-"}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-brand-ink font-bold text-[11px]">
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
                                          <th className="py-2 px-3">Màu sắc</th>
                                          <th className="py-2 px-3 text-center">Size</th>
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
                                          const itColor = String(it.color || "").trim();
                                          const itSize = String(it.size || "").trim();
                                          const childCode =
                                            itColor || itSize
                                              ? variantCodeFor(
                                                  it.productCode,
                                                  itColor,
                                                  itSize
                                                )
                                              : it.productCode;
                                          const matchedVar = (prod?.variants || []).find(
                                            (v) =>
                                              String(v.color || "").trim().toLowerCase() ===
                                              itColor.toLowerCase()
                                          );
                                          const hexes = resolveVariantColorHexes(
                                            itColor,
                                            matchedVar?.colorHexes
                                          );
                                          return (
                                            <tr key={it._id || idx} className="hover:bg-slate-50">
                                              <td className="py-2 px-3 text-center font-mono">
                                                {idx + 1}
                                              </td>
                                              <td className="py-2 px-3 font-mono font-bold text-slate-800">
                                                <div>{childCode}</div>
                                                {(itColor || itSize) && (
                                                  <div className="text-[10px] font-normal text-slate-400">
                                                    Gốc: {it.productCode}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 font-semibold text-slate-900">
                                                {it.productName}
                                              </td>
                                              <td className="py-2 px-3">
                                                {itColor ? (
                                                  <span
                                                    style={getColorBoxBorderStyle(
                                                      hexes,
                                                      "var(--box-bg, #f8fafc)",
                                                      2
                                                    )}
                                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 font-bold text-slate-800"
                                                  >
                                                    <ColorSwatchBadge
                                                      hexes={matchedVar?.colorHexes}
                                                      colorName={itColor}
                                                      size="xs"
                                                    />
                                                    <span>{itColor}</span>
                                                  </span>
                                                ) : (
                                                  <span className="text-slate-400">-</span>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                {Boolean(itSize) ? (
                                                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-brand-ink border border-indigo-200 font-mono font-extrabold">
                                                    {itSize}
                                                  </span>
                                                ) : (
                                                  <span className="text-slate-400">—</span>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                {(it as any).unit || prod?.unit || "Cái"}
                                              </td>
                                              <td className="py-2 px-3 font-semibold text-slate-700">
                                                {it.fromWarehouse === "FLOOR_2"
                                                  ? "🏬 Kho Tầng 2"
                                                  : "🏢 Kho Tầng 1"}
                                              </td>
                                              <td className="py-2 px-3 font-semibold text-brand-ink">
                                                {it.toWarehouse === "FLOOR_2"
                                                  ? "🏬 Kho Tầng 2"
                                                  : "🏢 Kho Tầng 1"}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-extrabold text-brand-ink">
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
          )}
        </div>
      )}

      {/* SUB-TAB 2: XUẤT KHO CHUYỂN TẦNG (KHO TẦNG 1 <-> KHO TẦNG 2) */}
      {subTab === "TRANSFER" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-brand-ink" />
                  Tạo Phiếu Xuất Kho Chuyển Tầng (Kho 1 ↔ Kho 2)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chọn hướng dời kho → thêm sản phẩm vào phiếu → bấm <strong>Xác nhận Tạo Phiếu Xuất Kho</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistoryView("TRANSFERS");
                  setSubTab("HISTORY");
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                Xem lịch sử chuyển tầng →
              </button>
            </div>

            {/* BƯỚC 1: CHỌN HƯỚNG DỜI KHO (GỌN 1 HÀNG) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleChangeTransferDirection("F1_TO_F2")}
                className={`px-3.5 py-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${transferDirection === "F1_TO_F2"
                  ? "bg-teal-600 text-white border-teal-700 shadow-sm"
                  : "bg-slate-50 text-slate-800 border-slate-200 hover:border-teal-400"
                  }`}
              >
                <div className="text-xs font-extrabold">
                  🏢 Kho Tầng 1 → 🏬 Kho Tầng 2
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-extrabold ${transferDirection === "F1_TO_F2"
                    ? "bg-white/20 text-white"
                    : "bg-white text-brand-ink border border-slate-200"
                    }`}
                >
                  {products.filter((p) => (Number(p.stockFloor1 ?? p.stock) || 0) > 0).length} SP
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleChangeTransferDirection("F2_TO_F1")}
                className={`px-3.5 py-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${transferDirection === "F2_TO_F1"
                  ? "bg-teal-600 text-white border-teal-700 shadow-sm"
                  : "bg-slate-50 text-slate-800 border-slate-200 hover:border-teal-400"
                  }`}
              >
                <div className="text-xs font-extrabold">
                  🏬 Kho Tầng 2 → 🏢 Kho Tầng 1
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-extrabold ${transferDirection === "F2_TO_F1"
                    ? "bg-white/20 text-white"
                    : "bg-white text-brand-ink border border-slate-200"
                    }`}
                >
                  {products.filter((p) => (Number(p.stockFloor2) || 0) > 0).length} SP
                </span>
              </button>
            </div>

            {/* BƯỚC 2: TÌM NHANH & THÊM SẢN PHẨM VÀO PHIẾU (KHÔNG ĐỔ LIST DÀI) */}
            {(() => {
              const activeTransferProdId = transferProductId;
              const selectedTransferProd = activeTransferProdId
                ? products.find((p) => p._id === activeTransferProdId)
                : undefined;
              const availVars = getProductSourceVariants(selectedTransferProd);
              const effectiveColor =
                transferColor ||
                (availVars.length > 0 && !transferSize
                  ? availVars[0].color || ""
                  : "");
              const effectiveSize =
                transferSize ||
                (availVars.length > 0 && !transferColor
                  ? availVars[0].size || ""
                  : "");

              const uniqueColorOptions: Array<{ color: string; totalStock: number }> = [];
              for (const v of availVars) {
                const cName = String(v.color || "").trim();
                const existingColor = uniqueColorOptions.find(
                  (c) => c.color.toLowerCase() === cName.toLowerCase()
                );
                const vStock = getVariantSourceFloorStock(v);
                if (existingColor) existingColor.totalStock += vStock;
                else uniqueColorOptions.push({ color: cName, totalStock: vStock });
              }

              const varsForSelectedColor =
                availVars.filter(
                  (v) =>
                    String(v.color || "").trim().toLowerCase() ===
                    String(effectiveColor || "").trim().toLowerCase()
                ).length > 0
                  ? availVars.filter(
                    (v) =>
                      String(v.color || "").trim().toLowerCase() ===
                      String(effectiveColor || "").trim().toLowerCase()
                  )
                  : availVars;

              const quickSuggestions = sourceFloorProducts.slice(0, 12);

              return (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <datalist id="transfer-size-presets">
                    {["S", "M", "L", "XL", "XXL", "36", "37", "38", "39", "40", "41", "42", "43", "44"].map(
                      (sz) => (
                        <option key={sz} value={sz} />
                      )
                    )}
                  </datalist>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                    {/* Ô tìm kiếm thông minh có dropdown gợi ý */}
                    <div className="md:col-span-5 relative">
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Tìm &amp; chọn SP tại {transferDirection === "F1_TO_F2" ? "Kho Tầng 1" : "Kho Tầng 2"}
                      </label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={transferSearch}
                          onFocus={() => setTransferSuggestOpen(true)}
                          onBlur={() => setTimeout(() => setTransferSuggestOpen(false), 180)}
                          onChange={(e) => {
                            setTransferSearch(e.target.value);
                            setTransferSuggestOpen(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (quickSuggestions.length > 0) {
                                const first = quickSuggestions[0];
                                handleSelectTransferProduct(first._id);
                                setTransferSearch(`${first.name} (${first.code})`);
                                setTransferSuggestOpen(false);
                              }
                            }
                          }}
                          placeholder={
                            selectedTransferProd
                              ? `${selectedTransferProd.name} (${selectedTransferProd.code})`
                              : "Gõ tên, mã gốc hoặc mã con..."
                          }
                          className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold focus:outline-none focus:border-teal-500"
                        />
                        {(transferSearch || transferProductId) && (
                          <button
                            type="button"
                            onClick={() => {
                              setTransferSearch("");
                              setTransferProductId("");
                              setTransferColor("");
                              setTransferSize("");
                              setTransferSuggestOpen(true);
                            }}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                            title="Xóa lựa chọn"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {transferSuggestOpen && (
                        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                          {quickSuggestions.length === 0 ? (
                            <div className="p-3 text-xs text-slate-400 text-center">
                              Không tìm thấy sản phẩm còn tồn ở kho đầu dời.
                            </div>
                          ) : (
                            quickSuggestions.map((p) => {
                              const avail = getSourceFloorStock(p);
                              const isPicked = p._id === activeTransferProdId;
                              return (
                                <button
                                  key={p._id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectTransferProduct(p._id);
                                    setTransferSearch(`${p.name} (${p.code})`);
                                    setTransferSuggestOpen(false);
                                  }}
                                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 hover:bg-teal-50 transition ${
                                    isPicked ? "bg-teal-50/80" : ""
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 truncate">{p.name}</div>
                                    <div className="font-mono text-[10px] text-slate-500">{p.code}</div>
                                  </div>
                                  <span className="px-2 py-0.5 rounded bg-teal-100 text-brand-ink font-mono font-bold text-[11px] shrink-0">
                                    Tồn: {avail} {p.unit}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-brand-ink mb-1">
                        Màu sắc
                      </label>
                      {uniqueColorOptions.length > 0 ? (
                        <select
                          value={String(effectiveColor || "").trim().toLowerCase()}
                          onChange={(e) => {
                            const nextColorLower = e.target.value;
                            const matchedColorVars = availVars.filter(
                              (v) =>
                                String(v.color || "").trim().toLowerCase() ===
                                nextColorLower
                            );
                            if (matchedColorVars.length > 0) {
                              setTransferColor(matchedColorVars[0].color || "");
                              setTransferSize(matchedColorVars[0].size || "");
                            } else {
                              setTransferColor("");
                              setTransferSize("");
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-xl border border-indigo-300 text-xs bg-white font-bold text-slate-900"
                        >
                          {uniqueColorOptions.map((cOpt, cIdx) => (
                            <option
                              key={`${cOpt.color}_${cIdx}`}
                              value={cOpt.color.toLowerCase()}
                            >
                              {cOpt.color || "Mặc định"} ({cOpt.totalStock})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <ColorInputWithPicker
                          value={transferColor}
                          onChange={(nextColor) => setTransferColor(nextColor)}
                          placeholder="Màu sắc..."
                        />
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-brand-ink mb-1">
                        Size
                      </label>
                      {varsForSelectedColor.length > 0 ? (
                        <select
                          value={String(effectiveSize || "").trim().toUpperCase()}
                          onChange={(e) => {
                            const nextSizeUpper = e.target.value;
                            const matchedVar = varsForSelectedColor.find(
                              (v) =>
                                String(v.size || "").trim().toUpperCase() ===
                                nextSizeUpper
                            );
                            if (matchedVar) {
                              setTransferColor(matchedVar.color || effectiveColor || "");
                              setTransferSize(matchedVar.size || "");
                            } else {
                              setTransferSize(e.target.value);
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-xl border border-indigo-300 text-xs bg-white font-mono font-bold text-slate-900"
                        >
                          {varsForSelectedColor.map((v, sIdx) => {
                            const szTrim = String(v.size || "").trim();
                            const szVal = szTrim.toUpperCase();
                            const vStock = getVariantSourceFloorStock(v);
                            return (
                              <option key={`${szVal}_${sIdx}`} value={szVal}>
                                {szTrim ? `${szTrim} (Tồn: ${vStock})` : `Không size (${vStock})`}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <input
                          type="text"
                          list="transfer-size-presets"
                          value={transferSize}
                          onChange={(e) => setTransferSize(e.target.value.toUpperCase())}
                          placeholder="VD: M, L, 41"
                          className="w-full px-2.5 py-2 rounded-xl border border-indigo-300 text-xs bg-white font-mono font-bold uppercase text-slate-900"
                        />
                      )}
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        SL
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={transferQty}
                        onChange={(e) =>
                          setTransferQty(Math.max(1, Math.round(Number(e.target.value) || 1)))
                        }
                        className="w-full px-2 py-2 rounded-xl border border-slate-300 font-mono text-sm font-extrabold text-right bg-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        disabled={!selectedTransferProd}
                        onClick={() =>
                          handleAddTransferItem(
                            activeTransferProdId,
                            transferQty,
                            effectiveColor,
                            effectiveSize
                          )
                        }
                        className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm vào phiếu
                      </button>
                    </div>
                  </div>

                  {/* Sản phẩm đang chọn + chip Màu/Size để bấm 1 chạm thêm nhanh */}
                  {selectedTransferProd && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-slate-700">
                          Đang chọn: <span className="text-brand-ink">{selectedTransferProd.name}</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          ({selectedTransferProd.code} · Tồn {getSourceFloorStock(selectedTransferProd)} {selectedTransferProd.unit})
                        </span>
                      </div>

                      {availVars.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {availVars.map((v, vIdx) => {
                            const vStock = getVariantSourceFloorStock(v);
                            const isSelectedVar =
                              String(v.color || "").trim().toLowerCase() ===
                              String(effectiveColor || "").trim().toLowerCase() &&
                              String(v.size || "").trim().toUpperCase() ===
                              String(effectiveSize || "").trim().toUpperCase();
                            const hexes = resolveVariantColorHexes(v.color, v.colorHexes);
                            return (
                              <button
                                key={`${v.color}-${v.size}-${vIdx}`}
                                type="button"
                                onClick={() => {
                                  setTransferColor(v.color || "");
                                  setTransferSize(v.size || "");
                                  handleAddTransferItem(
                                    activeTransferProdId,
                                    1,
                                    v.color || "",
                                    v.size || ""
                                  );
                                }}
                                style={getColorBoxBorderStyle(
                                  hexes,
                                  isSelectedVar ? "#eef2ff" : "#ffffff",
                                  2
                                )}
                                title="Bấm để thêm +1 biến thể này vào phiếu"
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition cursor-pointer ${isSelectedVar
                                  ? "ring-1 ring-indigo-600 text-indigo-950"
                                  : "border-slate-200 text-slate-800 hover:bg-indigo-50"
                                  }`}
                              >
                                <ColorSwatchBadge
                                  hexes={v.colorHexes}
                                  colorName={v.color || "Mặc định"}
                                  size="xs"
                                />
                                <span>{v.color || "Mặc định"}</span>
                                {Boolean(v.size?.trim()) && (
                                  <span className="font-mono text-brand-ink">· {v.size?.trim()}</span>
                                )}
                                <span className="font-mono text-brand-ink">({vStock})</span>
                                <span className="text-[10px] text-brand-ink font-extrabold">+1</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

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
                  Chưa có sản phẩm nào trong phiếu. Hãy bấm chọn các sản phẩm hoặc Màu sắc từ{" "}
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
                        <th className="py-2.5 px-3">Màu sắc</th>
                        <th className="py-2.5 px-3">Size (Kích cỡ)</th>
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
                        const itemKey = getTransferItemKey(
                          item.productId,
                          item.color,
                          item.size
                        );
                        const prodVars = getProductSourceVariants(prod);
                        const uniqueColors = Array.from(
                          new Set(
                            prodVars.map((v) => String(v.color || "").trim())
                          )
                        );
                        const sizesForColor =
                          prodVars.filter(
                            (v) =>
                              String(v.color || "").trim().toLowerCase() ===
                              String(item.color || "").trim().toLowerCase()
                          ).length > 0
                            ? prodVars.filter(
                              (v) =>
                                String(v.color || "").trim().toLowerCase() ===
                                String(item.color || "").trim().toLowerCase()
                            )
                            : prodVars;

                        const matchedVar = (prod.variants || []).find(
                          (v) =>
                            String(v.color || "").trim().toLowerCase() ===
                            String(item.color || "").trim().toLowerCase() &&
                            String(v.size || "").trim().toUpperCase() ===
                            String(item.size || "").trim().toUpperCase()
                        );
                        const maxAvail = getSourceVariantFloorStock(
                          prod,
                          item.color,
                          item.size
                        );
                        const childCode =
                          item.color || item.size
                            ? variantCodeFor(
                              prod.code,
                              item.color,
                              item.size
                            )
                            : prod.code;
                        const hexes = resolveVariantColorHexes(
                          item.color,
                          matchedVar?.colorHexes
                        );

                        return (
                          <tr key={itemKey} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                              <div>{childCode}</div>
                              {(item.color || item.size) && (
                                <div className="text-[10px] font-normal text-slate-400">
                                  Mã gốc: {prod.code}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {prod.name}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {item.color ? (
                                  <span
                                    style={getColorBoxBorderStyle(
                                      hexes,
                                      "var(--box-bg, #f8fafc)",
                                      2
                                    )}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 font-bold text-slate-800"
                                  >
                                    <ColorSwatchBadge
                                      hexes={matchedVar?.colorHexes}
                                      colorName={item.color}
                                      size="xs"
                                    />
                                    <span>{item.color}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">
                                    Mặc định
                                  </span>
                                )}

                                {uniqueColors.length > 1 && (
                                  <select
                                    value={String(item.color || "")
                                      .trim()
                                      .toLowerCase()}
                                    onChange={(e) => {
                                      const nextColorLower = e.target.value;
                                      const matchedColorVars = prodVars.filter(
                                        (v) =>
                                          String(v.color || "")
                                            .trim()
                                            .toLowerCase() === nextColorLower
                                      );
                                      if (matchedColorVars.length > 0) {
                                        const keepSameSize =
                                          matchedColorVars.find(
                                            (v) =>
                                              String(v.size || "")
                                                .trim()
                                                .toUpperCase() ===
                                              String(item.size || "")
                                                .trim()
                                                .toUpperCase()
                                          ) || matchedColorVars[0];
                                        handleUpdateTransferItemVariant(
                                          itemKey,
                                          keepSameSize.color || "",
                                          keepSameSize.size || ""
                                        );
                                      }
                                    }}
                                    className="px-2 py-1 rounded border border-slate-300 text-[11px] bg-white font-semibold text-slate-700"
                                    title="Đổi màu sắc cần dời"
                                  >
                                    {uniqueColors.map((cName, cIdx) => (
                                      <option
                                        key={`${cName}_${cIdx}`}
                                        value={cName.toLowerCase()}
                                      >
                                        Đổi màu: {cName || "Mặc định"}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {Boolean(item.size?.trim()) ? (
                                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-brand-ink font-mono text-xs font-extrabold">
                                    {item.size?.trim()}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">
                                    —
                                  </span>
                                )}

                                {sizesForColor.length > 1 ? (
                                  <select
                                    value={String(item.size || "")
                                      .trim()
                                      .toUpperCase()}
                                    onChange={(e) => {
                                      const nextSizeUpper = e.target.value;
                                      const picked = sizesForColor.find(
                                        (v) =>
                                          String(v.size || "")
                                            .trim()
                                            .toUpperCase() === nextSizeUpper
                                      );
                                      if (picked) {
                                        handleUpdateTransferItemVariant(
                                          itemKey,
                                          picked.color || item.color || "",
                                          picked.size || ""
                                        );
                                      }
                                    }}
                                    className="px-2 py-1 rounded border border-indigo-300 text-[11px] bg-white font-mono font-bold text-indigo-900"
                                    title="Chọn / đổi Size cần dời"
                                  >
                                    {sizesForColor.map((v, sIdx) => {
                                      const sz = String(v.size || "").trim();
                                      return (
                                        <option
                                          key={`${sz}_${sIdx}`}
                                          value={sz.toUpperCase()}
                                        >
                                          {sz
                                            ? `Size ${sz} (Tồn: ${getVariantSourceFloorStock(
                                              v
                                            )})`
                                            : `Không size (Tồn: ${getVariantSourceFloorStock(
                                              v
                                            )})`}
                                        </option>
                                      );
                                    })}
                                  </select>
                                ) : prodVars.length === 0 ? (
                                  <input
                                    type="text"
                                    list="transfer-size-presets"
                                    value={item.size || ""}
                                    onChange={(e) =>
                                      handleUpdateTransferItemVariant(
                                        itemKey,
                                        item.color || "",
                                        e.target.value.toUpperCase()
                                      )
                                    }
                                    placeholder="Chọn size..."
                                    className="w-24 px-2 py-1 rounded border border-slate-300 text-[11px] bg-white font-mono font-bold uppercase text-slate-800"
                                  />
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">{prod.unit}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-ink">
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
                                    itemKey,
                                    Number(e.target.value)
                                  )
                                }
                                className="w-24 px-2.5 py-1.5 rounded-lg border-2 border-indigo-400 font-mono font-extrabold text-right text-sm text-indigo-950"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveTransferItem(itemKey)}
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
                    className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Xác nhận Tạo Phiếu Xuất Kho ({transferItems.length} dòng)
                  </button>
                </div>
              </div>
            </form>
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
            <div className="px-6 py-4 bg-white text-slate-900 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-brand-ink">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-base text-slate-900">
                      Chi Tiết Nhập Hàng Vào Kho:{" "}
                      <span className="font-mono text-brand-ink">
                        {detailModalReceipt.code ||
                          detailModalReceipt.receiptCode ||
                          detailModalReceipt._id}
                      </span>
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${detailModalReceipt.status === "COMPLETED"
                        ? "bg-teal-50 text-brand-ink border border-teal-200"
                        : detailModalReceipt.status === "CHECKING"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-teal-50 text-brand-ink border border-teal-200"
                        }`}
                    >
                      {detailModalReceipt.status === "COMPLETED"
                        ? "ĐÃ HOÀN THÀNH"
                        : detailModalReceipt.status === "CHECKING"
                          ? "ĐANG KIỂM HÀNG"
                          : detailModalReceipt.status}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {detailModalReceipt.targetWarehouse === "FLOOR_2"
                        ? "🏬 Kho Tầng 2"
                        : "🏢 Kho Tầng 1"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
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
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
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
                  <div className="text-[11px] font-bold uppercase text-brand-ink flex items-center gap-1.5">
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

                <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 space-y-1">
                  <div className="text-[11px] font-bold uppercase text-brand-ink flex items-center gap-1.5">
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
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">STT</th>
                      <th className="py-2.5 px-3">Mã hàng</th>
                      <th className="py-2.5 px-3">Tên sản phẩm</th>
                      <th className="py-2.5 px-3 text-center">ĐVT</th>
                      <th className="py-2.5 px-3 text-right">SL Dự kiến</th>
                      <th className="py-2.5 px-3 text-right">SL Thực nhập</th>
                      <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                      <th className="py-2.5 px-3 text-right">Giá vốn (VND)</th>
                      <th className="py-2.5 px-3 text-right">Giá niêm yết (VND)</th>
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
                      const sell = Number(it.sellingPrice || prod?.sellingPrice || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-400">
                            {it.stt || idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            <div>
                              {it.variantCode || variantCodeFor(it.productCode, it.color, it.size)}
                            </div>
                            {(it.color || it.size) && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                Gốc: {it.productCode}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {it.productName}
                          </td>
                          <td className="py-2 px-3 text-center">{it.unit || "Cái"}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {expQty}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-extrabold text-brand-ink">
                            {actQty}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {diff === 0 ? (
                              <span className="text-brand-ink">Khớp (0)</span>
                            ) : (
                              <span className={diff > 0 ? "text-brand-ink" : "text-red-600"}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-amber-800 whitespace-nowrap">
                            {formatVND(cost)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-brand-ink whitespace-nowrap">
                            {formatVND(sell)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatVND(actQty * cost)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {Array.isArray(it.scanCounts) && it.scanCounts.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {it.scanCounts.map((sc: any, sIdx: number) => (
                                  <div key={sIdx} className="inline-flex items-center gap-1">
                                    <span className="font-semibold text-slate-800">
                                      {sc.name} ({sc.quantity})
                                    </span>
                                    <CmsRoleBadge role={sc.role} compact />
                                  </div>
                                ))}
                              </div>
                            ) : it.checkedByName ? (
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
                      <td className="py-2.5 px-3 text-right font-mono text-brand-ink">
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
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
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
            <div className="px-5 py-3.5 bg-white text-slate-900 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold flex items-center gap-2 text-slate-900">
                  <Plus className="w-4 h-4 text-brand-ink" />
                  <span>Nhập Kho Sản Phẩm — Chọn Sản phẩm & Biến thể từ Danh mục</span>
                </h3>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Chọn sản phẩm/biến thể đã tạo sẵn (hoặc quét mã vạch), nhập <strong>Số lượng</strong> và <strong>Giá nhập</strong> là xong. Hàng mới chưa có trong danh mục thì bấm <strong>+ Tạo SP mới</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminImportModal(false)}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer"
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

              {/* Khung Ghi chú, Chọn Kho & Bộ lọc nhanh Category / Thương hiệu */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Ghi chú Phiếu nhập kho
                  </label>
                  <input
                    type="text"
                    value={adminImportNote}
                    onChange={(e) => setAdminImportNote(e.target.value)}
                    placeholder="VD: Nhập lô hàng Giày Asics & Vợt Kamito đợt mới..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Lọc Category gợi ý
                  </label>
                  <select
                    value={importFilterCatId}
                    onChange={(e) => {
                      setImportFilterCatId(e.target.value);
                      setImportFilterBrandId("");
                    }}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="">Tất cả Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        [{c.skuCode || c.code}] {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Lọc Thương hiệu gợi ý
                  </label>
                  <select
                    value={importFilterBrandId}
                    onChange={(e) => setImportFilterBrandId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="">Tất cả Thương hiệu</option>
                    {brandOptions
                      .filter(
                        (b) =>
                          !importFilterCatId ||
                          b.isSystem ||
                          (b.categoryIds || []).map(String).includes(importFilterCatId)
                      )
                      .map((b) => (
                        <option key={b._id} value={b._id}>
                          [{b.code}] {b.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold uppercase text-brand-ink mb-1">
                    Nhập vào Kho (Chọn Tầng) *
                  </label>
                  <select
                    value={newProdWarehouse}
                    onChange={(e) =>
                      setNewProdWarehouse(
                        e.target.value === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1"
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border-2 border-teal-600 text-sm font-bold text-slate-900 bg-teal-50/40"
                  >
                    <option value="FLOOR_1">🏢 Kho Tầng 1</option>
                    <option value="FLOOR_2">🏬 Kho Tầng 2</option>
                  </select>
                </div>
              </div>

              {/* Thanh công cụ gọn: + Tạo SP mới (nếu chưa có), Import File, In Tem & Tick xác nhận */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCodeCreator(true)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                    title="Nếu mặt hàng mới về chưa có trong danh mục, bấm để khai báo SP chuẩn mã rồi tự động đưa vào phiếu nhập"
                  >
                    <CopyPlus className="w-4 h-4" />
                    <span>+ Tạo SP mới (chưa có trong danh mục)</span>
                  </button>

                  <button
                    type="button"
                    disabled={importingAdminFile}
                    onClick={() => {
                      setAdminFileImportMode("replace");
                      adminFileInputRef.current?.click();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-teal-400" />
                    <span>
                      {importingAdminFile
                        ? "Đang đọc file..."
                        : "📄 Import PDF / Excel"}
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
                      className="px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-brand-ink border border-teal-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>+ Nối thêm file</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadAdminSampleCsv}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-600" />
                    <span>File Mẫu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const valid = adminImportRows.filter((r) => r.productName.trim() !== "");
                      if (valid.length === 0) {
                        alert("Chưa có dòng sản phẩm nào để in tem mã vạch!");
                        return;
                      }
                      const printable = valid.filter((it) => {
                        if (!it.productCode) return false;
                        const prod = catalogByCode.get(it.productCode.toUpperCase());
                        if (!prod) return false;
                        if (!prod.versionCode || (!it.color && !it.size)) return true;
                        return Boolean(findVariantByColorSize(prod, it.color, it.size));
                      });
                      if (printable.length === 0) {
                        alert(
                          "Các dòng chưa có mã do hệ thống sinh (biến thể mới). Hãy Hoàn thành nhập kho trước rồi in tem."
                        );
                        return;
                      }
                      if (printable.length < valid.length) {
                        alert(
                          `${valid.length - printable.length} dòng là biến thể mới chưa có mã — sẽ bỏ qua khi in. Hoàn thành nhập kho để hệ thống sinh mã.`
                        );
                      }
                      setLabelItems(
                        printable.map((it, idx) => {
                          const baseCode = it.productCode;
                          const childCode = variantCodeFor(baseCode, it.color, it.size);
                          const matchedProd = catalogByCode.get(baseCode.toUpperCase());
                          const matchedVariant = findVariantByColorSize(matchedProd, it.color, it.size);
                          const resolvedSellPrice =
                            Number(it.sellingPrice) > 0
                              ? Number(it.sellingPrice)
                              : matchedProd
                                ? variantEffectiveSellingPrice(matchedProd, matchedVariant)
                                : 0;
                          return {
                            id: `${childCode}_${idx}`,
                            code: childCode,
                            productCode: baseCode,
                            productName: it.productName,
                            color: it.color,
                            size: it.size,
                            sellingPrice: resolvedSellPrice,
                            unit: it.unit,
                            defaultQty: Math.max(1, Number(it.quantity || 1)),
                          };
                        })
                      );
                      setShowLabelModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      🖨️ In Tem ({adminImportRows.filter((r) => r.productName.trim() !== "").length})
                    </span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-teal-100 text-brand-ink font-bold">
                    Xác nhận: {adminImportRows.filter((r) => r.isConfirmed).length}/
                    {adminImportRows.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-teal-600 text-white font-bold">
                    Tổng vốn:{" "}
                    {formatVND(
                      adminImportRows.reduce(
                        (s, r) => s + (Number(r.costPrice) || 0) * (Number(r.quantity) || 0),
                        0
                      )
                    )}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-teal-700 text-white font-bold">
                    Tổng niêm yết:{" "}
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
                    className="px-3 py-1.5 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Tick xác nhận tất cả
                  </button>
                </div>
              </div>

              {/* Bảng nhập gọn: Chọn Sản phẩm có sẵn -> Chọn Biến thể (Màu • Size) -> SL -> Giá */}
              <div
                className={`overflow-x-auto border border-slate-200 rounded-xl transition-all ${activeAdminSuggestRowIdx !== null ? "pb-60" : ""
                  }`}
              >
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                    <tr>
                      <th className="py-3 px-2 text-center w-10">STT</th>
                      <th className="py-3 px-3 min-w-[280px]">
                        SẢN PHẨM (CHỌN TỪ DANH MỤC / QUÉT MÃ) *
                      </th>
                      <th className="py-3 px-3 min-w-[230px] text-amber-300">
                        BIẾN THỂ (MÀU • SIZE & MÃ CON) *
                      </th>
                      <th className="py-3 px-2 w-16 text-center">ĐVT</th>
                      <th className="py-3 px-2 w-24 min-w-[85px] text-right bg-amber-50 text-amber-800">
                        SỐ LƯỢNG
                      </th>
                      <th className="py-3 px-2.5 w-32 min-w-[120px] text-right">
                        GIÁ VỐN NHẬP (VND)
                      </th>
                      <th className="py-3 px-2.5 w-32 min-w-[120px] text-right text-brand-ink">
                        GIÁ NIÊM YẾT (VND)
                      </th>
                      <th className="py-3 px-2 min-w-[120px]">GHI CHÚ</th>
                      <th className="py-3 px-2 w-20 text-center bg-teal-50 text-brand-ink">
                        XÁC NHẬN
                      </th>
                      <th className="py-3 px-2 w-16 text-center">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {adminImportRows.map((row, idx) => {
                      const existingProd =
                        (row.productId &&
                          (allCatalogProducts.length > 0 ? allCatalogProducts : products).find(
                            (p) => p._id === row.productId
                          )) ||
                        (row.productCode
                          ? catalogByCode.get(row.productCode.toUpperCase()) ||
                          productByCode.get(row.productCode)
                          : undefined);
                      const prodVariants = (existingProd?.variants || []).filter(
                        (v) => v.color || v.size
                      );
                      const currentVarKey = row.isNewVariant
                        ? "__NEW__"
                        : `${row.color || ""}||${row.size || ""}`;
                      const resolvedVarCode = existingProd
                        ? resolveVariantCode(existingProd, existingProd.code, row.color, row.size)
                        : variantCodeFor(row.productCode, row.color, row.size);

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50 ${row.isConfirmed ? "bg-teal-50/20" : ""}`}
                        >
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700 align-top pt-3.5">
                            {idx + 1}
                          </td>

                          {/* CỘT 1: CHỌN SẢN PHẨM TỪ DANH MỤC */}
                          <td className="py-2.5 px-3 align-top">
                            {existingProd ? (
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <span className="font-mono font-extrabold text-[11px] text-brand-ink bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded mr-1.5">
                                      {existingProd.code}
                                    </span>
                                    <span className="font-bold text-slate-900 text-xs">
                                      {existingProd.name}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleClearAdminRowProduct(idx)}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 hover:text-red-600 bg-white border border-slate-200 hover:border-red-200 shrink-0 cursor-pointer"
                                  >
                                    Đổi SP
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                                    {existingProd.categoryName || "Danh mục"}
                                  </span>
                                  {(existingProd.brandName || existingProd.brand) && (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-brand-ink font-bold">
                                      {existingProd.brandCode ? `[${existingProd.brandCode}] ` : ""}
                                      {existingProd.brandName || existingProd.brand}
                                    </span>
                                  )}
                                  {existingProd.versionName && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold">
                                      Ver: {existingProd.versionName}
                                    </span>
                                  )}
                                  <span className="text-brand-ink font-bold ml-auto">
                                    Tồn: {existingProd.stock} {existingProd.unit}
                                  </span>
                                </div>
                              </div>
                            ) : (
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
                                      if (picked) {
                                        e.preventDefault();
                                        handleSelectAdminRowSuggestion(idx, picked);
                                      }
                                    } else if (e.key === "Escape") {
                                      setActiveAdminSuggestRowIdx(null);
                                    }
                                  }}
                                  placeholder="🔍 Gõ tên, mã SP, version để chọn..."
                                  className="w-full px-2.5 py-2 rounded-lg border-2 border-teal-500/70 font-medium text-slate-900 focus:border-teal-600 focus:outline-none"
                                />
                                {activeAdminSuggestRowIdx === idx &&
                                  (() => {
                                    const suggestions = getAdminRowSuggestions(row.productName);
                                    return (
                                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl border-2 border-teal-500 shadow-2xl overflow-hidden min-w-[340px]">
                                        <div className="px-3 py-1.5 bg-teal-600 text-white text-[10px] font-bold flex items-center justify-between gap-2">
                                          <span>
                                            📦 Chọn sản phẩm từ danh mục ({suggestions.length})
                                          </span>
                                          <button
                                            type="button"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              setActiveAdminSuggestRowIdx(null);
                                              setShowCodeCreator(true);
                                            }}
                                            className="text-amber-300 hover:underline font-extrabold cursor-pointer"
                                          >
                                            + Tạo SP mới
                                          </button>
                                        </div>
                                        {suggestions.length === 0 ? (
                                          <div className="p-3 text-center text-xs text-slate-500">
                                            Không tìm thấy sản phẩm khớp. Bấm{" "}
                                            <button
                                              type="button"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                setActiveAdminSuggestRowIdx(null);
                                                setShowCodeCreator(true);
                                              }}
                                              className="font-extrabold text-brand-ink underline cursor-pointer"
                                            >
                                              + Tạo SP mới
                                            </button>{" "}
                                            để khai báo.
                                          </div>
                                        ) : (
                                          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                                            {suggestions.map((p, sIdx) => {
                                              const isHighlighted =
                                                sIdx === adminSuggestHighlightIdx;
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
                                                  className={`w-full text-left px-3 py-2 transition flex flex-col gap-0.5 cursor-pointer ${isHighlighted
                                                      ? "bg-teal-50/90"
                                                      : "hover:bg-slate-50"
                                                    }`}
                                                >
                                                  <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                                    <span className="font-mono font-extrabold text-[11px] text-brand-ink bg-teal-50 px-1.5 py-0.5 rounded">
                                                      {p.code}
                                                    </span>
                                                    <span>{p.name}</span>
                                                  </div>
                                                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                                                    <span>
                                                      {p.categoryName}
                                                      {p.brandName || p.brand
                                                        ? ` • ${p.brandName || p.brand}`
                                                        : ""}
                                                      {p.versionName
                                                        ? ` • ${p.versionName}`
                                                        : ""}
                                                    </span>
                                                    <span className="text-brand-ink font-bold">
                                                      {(p.variants || []).length} biến thể • Tồn:{" "}
                                                      {p.stock} {p.unit}
                                                    </span>
                                                  </div>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                              </div>
                            )}
                          </td>

                          {/* CỘT 2: CHỌN BIẾN THỂ (MÀU • SIZE & MÃ CON) */}
                          <td className="py-2.5 px-3 align-top">
                            {existingProd && prodVariants.length > 0 && !row.isNewVariant ? (
                              <div className="space-y-1.5">
                                <select
                                  value={currentVarKey}
                                  onChange={(e) =>
                                    handleSelectAdminRowVariant(idx, existingProd, e.target.value)
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                                >
                                  {prodVariants.map((v, vIdx) => {
                                    const val = `${v.color || ""}||${v.size || ""}`;
                                    const vCode = resolveVariantCode(
                                      existingProd,
                                      existingProd.code,
                                      v.color,
                                      v.size
                                    );
                                    return (
                                      <option key={`${val}_${vIdx}`} value={val}>
                                        {v.color || "Mặc định"}
                                        {v.size ? ` - Size ${v.size}` : ""} ({vCode}) • Tồn:{" "}
                                        {v.stock ?? 0}
                                      </option>
                                    );
                                  })}
                                  <option value="__NEW__">+ Thêm Màu / Size mới cho SP này...</option>
                                </select>
                                {resolvedVarCode && (
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-mono font-extrabold text-brand-ink bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                      Mã con: {resolvedVarCode}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                                  <div className="sm:col-span-8">
                                    <ColorInputWithPicker
                                      listId="cms-color-suggestions"
                                      value={row.color}
                                      colorHexes={row.colorHexes}
                                      onChange={(nextColor, nextHexes) =>
                                        handleUpdateAdminRowColor(idx, nextColor, nextHexes)
                                      }
                                      placeholder="Màu sắc *"
                                    />
                                  </div>
                                  <div className="sm:col-span-4">
                                    <input
                                      type="text"
                                      list="cms-size-suggestions"
                                      value={row.size}
                                      onChange={(e) =>
                                        handleUpdateAdminRow(
                                          idx,
                                          "size",
                                          e.target.value.toUpperCase()
                                        )
                                      }
                                      placeholder="Size (41, L..)"
                                      className="w-full px-2 py-1.5 rounded border border-slate-300 text-center font-mono font-extrabold uppercase text-brand-ink focus:border-teal-600 focus:outline-none"
                                    />
                                  </div>
                                </div>
                                {existingProd && prodVariants.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSelectAdminRowVariant(
                                        idx,
                                        existingProd,
                                        `${prodVariants[0].color || ""}||${prodVariants[0].size || ""}`
                                      )
                                    }
                                    className="text-[10px] font-bold text-brand-ink hover:underline cursor-pointer"
                                  >
                                    ← Chọn từ {prodVariants.length} biến thể có sẵn
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* ĐVT */}
                          <td className="py-2.5 px-2 text-center align-top pt-3.5 font-semibold text-slate-700">
                            {existingProd?.unit || row.unit || "Cái"}
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
                              className="w-full px-2 py-1.5 rounded border border-teal-300 text-right font-mono font-bold text-teal-900"
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

                          {/* XÁC NHẬN */}
                          <td className="py-2.5 px-2 text-center bg-teal-50/30 align-top pt-3">
                            <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={row.isConfirmed}
                                onChange={(e) =>
                                  handleUpdateAdminRow(idx, "isConfirmed", e.target.checked)
                                }
                                className="w-4 h-4 accent-teal-600 rounded"
                              />
                              <span
                                className={`text-[10px] font-bold ${row.isConfirmed ? "text-brand-ink" : "text-slate-400"
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
                                className="p-1.5 text-brand-ink hover:bg-teal-50 rounded cursor-pointer"
                                title="Thêm nhanh biến thể khác cho cùng sản phẩm này"
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
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm dòng nhập kho</span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Chọn <strong>Sản phẩm</strong> → chọn <strong>Biến thể (Màu • Size)</strong> → điền <strong>Số lượng</strong>. Bấm biểu tượng nhân bản ở cuối dòng để nhập thêm Màu/Size khác của cùng sản phẩm.
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
                    className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {submittingAdminImport
                        ? "Đang nhập kho..."
                        : `✅ Hoàn thành Nhập Kho (${adminImportRows.filter(
                          (r) =>
                            (r.productName.trim() !== "" || r.productCode.trim() !== "") &&
                            r.isConfirmed
                        ).length} dòng đã tick)`}
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

      {/* MODAL CẤU HÌNH LIÊN KẾT & TỰ ĐỘNG TÁCH SẢN PHẨM BỘ ↔ SẢN PHẨM LẺ */}
      {setLinkModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 bg-white text-slate-900 border-b border-slate-200 rounded-t-2xl flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase text-brand-ink">
                  Cơ chế Tự động Tách Bộ ↔ Bán Lẻ — 11Sport
                </div>
                <h3 className="text-sm font-extrabold mt-0.5 text-slate-900">
                  🔗 Cấu hình Bộ ↔ Lẻ: {setLinkModalProduct.name} ({setLinkModalProduct.code})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSetLinkModalProduct(null)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕ Đóng
              </button>
            </div>

            <form onSubmit={handleSaveSetLink} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-950 space-y-1">
                <div className="font-extrabold flex items-center gap-1.5">
                  <span>💡 Cách hoạt động tự động (không cần chỉnh tay khi hết hàng lẻ):</span>
                </div>
                <p className="text-[11px] text-teal-900 leading-relaxed">
                  Khi <b>Sản phẩm Lẻ</b> được gắn với <b>Sản phẩm Bộ/Hộp gốc</b> (ví dụ: 1 Ống = 12 Quả, 1 Hộp = 60 Cái):
                  nếu khách mua lẻ tại POS mà tồn lẻ ở Kho Tầng 1 đã hết hoặc thiếu, hệ thống sẽ{" "}
                  <b>tự động trừ -1 ở Sản phẩm Bộ (Kho Tầng 1)</b>, <b>cộng +N vào Sản phẩm Lẻ</b> rồi xuất bán ngay và ghi Sổ kho đầy đủ.
                </p>
              </div>

              {/* Chọn vai trò của sản phẩm đang mở */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSetLinkMode("AS_RETAIL")}
                  className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${setLinkMode === "AS_RETAIL"
                    ? "border-amber-500 bg-amber-50 text-amber-950 shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  <div className="font-extrabold text-xs">
                    🔹 Sản phẩm này là SẢN PHẨM LẺ
                  </div>
                  <div className="text-[11px] mt-0.5 opacity-85">
                    Chọn 1 Sản phẩm Bộ/Hộp gốc trong kho để tự động rút hàng khi mã lẻ này hết tồn.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSetLinkMode("AS_SET")}
                  className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${setLinkMode === "AS_SET"
                    ? "border-teal-600 bg-teal-50 text-teal-950 shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  <div className="font-extrabold text-xs">
                    📦 Sản phẩm này là SẢN PHẨM BỘ / HỘP
                  </div>
                  <div className="text-[11px] mt-0.5 opacity-85">
                    Tạo nhanh mã Sản phẩm Lẻ mới từ Bộ này hoặc gắn với 1 mã Sản phẩm Lẻ có sẵn.
                  </div>
                </button>
              </div>

              {setLinkMode === "AS_RETAIL" ? (
                <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block font-extrabold text-slate-800 mb-1">
                      1. Chọn Sản phẩm Bộ / Hộp / Ống gốc trong kho:
                    </label>
                    <input
                      type="text"
                      value={setLinkSearch}
                      onChange={(e) => setSetLinkSearch(e.target.value)}
                      placeholder="Gõ tìm tên hoặc mã Sản phẩm Bộ/Hộp..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white mb-2"
                    />
                    <select
                      value={selectedParentSetId}
                      onChange={(e) => setSelectedParentSetId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                    >
                      <option value="">-- Chọn Sản phẩm Bộ / Hộp gốc --</option>
                      {(allCatalogProducts.length > 0 ? allCatalogProducts : products)
                        .filter((cand) => {
                          if (cand._id === setLinkModalProduct._id) return false;
                          if (!setLinkSearch.trim()) return true;
                          const q = setLinkSearch.trim().toLowerCase();
                          return (
                            cand.code.toLowerCase().includes(q) ||
                            cand.name.toLowerCase().includes(q) ||
                            (cand.unit || "").toLowerCase().includes(q)
                          );
                        })
                        .map((cand) => (
                          <option key={cand._id} value={cand._id}>
                            [{cand.code}] {cand.name} — ĐVT: {cand.unit} (Tồn T1:{" "}
                            {cand.stockFloor1 ?? cand.stock ?? 0} {cand.unit}
                            {(cand.stockFloor2 ?? 0) > 0 ? `, T2: ${cand.stockFloor2}` : ""})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block font-extrabold text-slate-800 mb-1">
                        2. Tỷ lệ quy đổi (1 Bộ/Hộp = bao nhiêu {setLinkModalProduct.unit}?):
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={packSizeInput}
                        onChange={(e) =>
                          setPackSizeInput(Math.max(1, Math.round(Number(e.target.value) || 1)))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-extrabold text-slate-900"
                      />
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-950 font-bold">
                      Quy ước: Trừ <b>-1 Bộ/Hộp</b> → Tự động cộng{" "}
                      <b>
                        +{packSizeInput} {setLinkModalProduct.unit}
                      </b>{" "}
                      vào mã <span className="font-mono">{setLinkModalProduct.code}</span>
                    </div>
                  </div>

                  {setLinkModalProduct.parentSetProductId && (
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">
                        Đang liên kết với:{" "}
                        <b className="font-mono text-slate-900">
                          {setLinkModalProduct.parentSetProductCode ||
                            setLinkModalProduct.parentSetProductId}
                        </b>
                      </span>
                      <button
                        type="button"
                        disabled={savingSetLink}
                        onClick={() => handleClearSetLink(setLinkModalProduct._id)}
                        className="px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] cursor-pointer"
                      >
                        Gỡ liên kết Bộ ↔ Lẻ
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSetChildMode("CREATE_NEW_RETAIL")}
                      className={`px-3 py-1.5 rounded-lg font-extrabold text-xs transition cursor-pointer ${setChildMode === "CREATE_NEW_RETAIL"
                        ? "bg-teal-700 text-white"
                        : "bg-white border border-slate-300 text-slate-700"
                        }`}
                    >
                      ✨ Tạo nhanh Sản phẩm Lẻ mới từ Bộ này
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetChildMode("EXISTING_RETAIL")}
                      className={`px-3 py-1.5 rounded-lg font-extrabold text-xs transition cursor-pointer ${setChildMode === "EXISTING_RETAIL"
                        ? "bg-teal-700 text-white"
                        : "bg-white border border-slate-300 text-slate-700"
                        }`}
                    >
                      🔗 Chọn Sản phẩm Lẻ đã có sẵn trong kho
                    </button>
                  </div>

                  {setChildMode === "CREATE_NEW_RETAIL" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block font-extrabold text-slate-800 mb-1">
                          Tên Sản phẩm Lẻ mới:
                        </label>
                        <input
                          type="text"
                          value={newRetailName}
                          onChange={(e) => setNewRetailName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-extrabold text-slate-800 mb-1">
                          Đơn vị tính Lẻ (VD: Cái, Quả, Đôi, Chiếc):
                        </label>
                        <input
                          type="text"
                          value={newRetailUnit}
                          onChange={(e) => setNewRetailUnit(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-extrabold text-slate-800 mb-1">
                          Số lượng lẻ trong 1 {setLinkModalProduct.unit}:
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={packSizeInput}
                          onChange={(e) => {
                            const nextPack = Math.max(1, Math.round(Number(e.target.value) || 1));
                            setPackSizeInput(nextPack);
                            if (setLinkModalProduct.sellingPrice > 0) {
                              setNewRetailSellingPrice(
                                Math.ceil(setLinkModalProduct.sellingPrice / nextPack / 1000) * 1000
                              );
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-extrabold"
                        />
                      </div>
                      <div>
                        <label className="block font-extrabold text-slate-800 mb-1">
                          Giá niêm yết / 1 {newRetailUnit || "Cái"} (VND):
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            newRetailSellingPrice > 0 ? formatNumberDots(newRetailSellingPrice) : ""
                          }
                          placeholder="0"
                          onChange={(e) =>
                            setNewRetailSellingPrice(parseNumberDots(e.target.value))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-extrabold text-brand-ink"
                        />
                      </div>
                      <div className="p-2.5 rounded-lg bg-teal-100/80 border border-teal-300 text-teal-950 font-semibold flex items-center">
                        <span>
                          1 {setLinkModalProduct.unit} ={" "}
                          <b>
                            {packSizeInput} {newRetailUnit || "Cái"}
                          </b>{" "}
                          • Giá vốn lẻ tự tính:{" "}
                          <b>
                            {formatVND(
                              Math.round(
                                (Number(setLinkModalProduct.costPrice) || 0) /
                                Math.max(1, packSizeInput)
                              )
                            )}
                          </b>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block font-extrabold text-slate-800 mb-1">
                          Chọn Sản phẩm Lẻ có sẵn trong kho:
                        </label>
                        <input
                          type="text"
                          value={setLinkSearch}
                          onChange={(e) => setSetLinkSearch(e.target.value)}
                          placeholder="Gõ tìm tên hoặc mã Sản phẩm Lẻ..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white mb-2"
                        />
                        <select
                          value={selectedExistingRetailId}
                          onChange={(e) => setSelectedExistingRetailId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                        >
                          <option value="">-- Chọn Sản phẩm Lẻ --</option>
                          {(allCatalogProducts.length > 0 ? allCatalogProducts : products)
                            .filter((cand) => {
                              if (cand._id === setLinkModalProduct._id) return false;
                              if (!setLinkSearch.trim()) return true;
                              const q = setLinkSearch.trim().toLowerCase();
                              return (
                                cand.code.toLowerCase().includes(q) ||
                                cand.name.toLowerCase().includes(q)
                              );
                            })
                            .map((cand) => (
                              <option key={cand._id} value={cand._id}>
                                [{cand.code}] {cand.name} — ĐVT: {cand.unit} (Tồn lẻ T1:{" "}
                                {cand.stockFloor1 ?? cand.stock ?? 0})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-extrabold text-slate-800 mb-1">
                          Số lượng lẻ trong 1 {setLinkModalProduct.unit}:
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={packSizeInput}
                          onChange={(e) =>
                            setPackSizeInput(Math.max(1, Math.round(Number(e.target.value) || 1)))
                          }
                          className="w-40 px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-extrabold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Khu vực Tách bộ chủ động ngay trong Modal nếu đã có liên kết */}
              {((setLinkModalProduct.parentSetProductId &&
                (setLinkModalProduct.packSize || 0) > 0) ||
                (Array.isArray(setLinkModalProduct.linkedRetailProducts) &&
                  setLinkModalProduct.linkedRetailProducts.length > 0)) && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5">
                    <div className="font-extrabold text-amber-950 flex items-center justify-between">
                      <span>⚡ Tách Bộ Sang Lẻ Ngay Lập Tức (Chủ động bày kệ)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={modalUnpackWarehouse}
                        onChange={(e) =>
                          setModalUnpackWarehouse(e.target.value as WarehouseFloor)
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white font-bold text-slate-800"
                      >
                        <option value="FLOOR_1">🏢 Tách tại Kho Tầng 1</option>
                        <option value="FLOOR_2">🏬 Tách tại Kho Tầng 2</option>
                      </select>
                      <div className="flex items-center gap-1.5">
                        <span>Số bộ tách:</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={modalUnpackCount}
                          onChange={(e) =>
                            setModalUnpackCount(
                              Math.max(1, Math.round(Number(e.target.value) || 1))
                            )
                          }
                          className="w-20 px-2 py-1.5 rounded-lg border border-amber-300 bg-white font-mono font-extrabold text-center"
                        />
                      </div>
                      {setLinkModalProduct.parentSetProductId &&
                        (setLinkModalProduct.packSize || 0) > 0 && (
                          <button
                            type="button"
                            disabled={unpackingLoadingId === setLinkModalProduct._id}
                            onClick={() =>
                              handleQuickUnpackSet(
                                setLinkModalProduct._id,
                                modalUnpackCount,
                                modalUnpackWarehouse
                              )
                            }
                            className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-extrabold cursor-pointer"
                          >
                            ⚡ Tách {modalUnpackCount}{" "}
                            {setLinkModalProduct.parentSetUnit || "Bộ"} → +
                            {modalUnpackCount * (setLinkModalProduct.packSize || 1)}{" "}
                            {setLinkModalProduct.unit}
                          </button>
                        )}
                      {Array.isArray(setLinkModalProduct.linkedRetailProducts) &&
                        setLinkModalProduct.linkedRetailProducts.map((ret) => (
                          <button
                            key={ret._id}
                            type="button"
                            disabled={unpackingLoadingId === ret._id}
                            onClick={() =>
                              handleQuickUnpackSet(
                                ret._id,
                                modalUnpackCount,
                                modalUnpackWarehouse
                              )
                            }
                            className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-extrabold cursor-pointer"
                          >
                            ⚡ Tách {modalUnpackCount} {setLinkModalProduct.unit} → +
                            {modalUnpackCount * ret.packSize} {ret.unit} ({ret.code})
                          </button>
                        ))}
                    </div>
                  </div>
                )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSetLinkModalProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingSetLink}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-extrabold cursor-pointer"
                >
                  {savingSetLink ? "Đang lưu..." : "💾 Lưu cấu hình Bộ ↔ Lẻ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IN TEM NHÃN MÃ VẠCH CODE128 (CHỈ MÃ SẢN PHẨM CHUNG, KHÔNG KÈM MÀU/SIZE) */}
      <ProductCodeCreatorModal
        open={showCodeCreator || Boolean(editingProductModal)}
        onClose={() => {
          setShowCodeCreator(false);
          setEditingProductModal(null);
        }}
        categories={categories}
        defaultCategoryId={newProdCatId || categoryId || undefined}
        editingProduct={editingProductModal}
        canSeeCost={canSeeCost}
        onDone={handleCodeCreatorDone}
        colorSuggestions={COMMON_COLORS}
        sizeSuggestions={COMMON_SIZES}
      />
      <BarcodeLabelModal
        open={showLabelModal}
        onClose={() => setShowLabelModal(false)}
        items={labelItems}
        title="In Tem Nhãn Mã Vạch (CMS Quản lý Kho)"
      />
    </div>
  );
}
