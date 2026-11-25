import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import BarcodeLabelModal, { BarcodeLabelItem } from "@/shared/ui/BarcodeLabelModal";
import ProductCodeCreatorModal, { ProductCodeCreatorResult } from "@/shared/ui/ProductCodeCreatorModal";
import {
  ColorInputWithPicker,
  ColorSwatchBadge,
  getColorBoxBorderStyle,
  resolveVariantColorHexes,
} from "@/shared/ui/ColorSwatchPicker";
import {
  cleanBarcodeCode,
  findProductAndVariantByScannedBarcode,
  findProductByScannedBarcode,
  isScannedCodeMatch,
  playScannerBeep,
  useHardwareBarcodeScanner,
} from "@/shared/lib/barcodeScanner";
import { exportProducts, exportInventoryReport, exportMovements, exportImports } from "../exports";
import { Product, ProductVariant, Category, StockMovement, InventoryReportRow, WarehouseFloor, Brand } from "@/shared/types";
import { apiRequest, getStoredUser } from "@/shared/api/client";
import { formatVND, formatNumberDots, parseNumberDots, formatDateTime, formatVariantLabel } from "@/shared/utils/format";
import { resolveVariantCode, findVariantByColorSize, variantEffectiveSellingPrice, variantEffectiveCostPrice, extractVariantFromText } from "@/shared/utils/productCode";
import { lookupProductByCodeApi, fetchBrandsApi } from "@/shared/api/catalogLookup";
import { describeApiError } from "@/shared/api/errors";
import { useDebounce, filterAndRankBySearch } from "@/shared/lib/search";
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
import {
  AdminImportRow,
  SubTab,
  HistoryView,
  ActiveWarehouseTab,
  QuickStockFilter,
  COMMON_COLORS,
  COMMON_SIZES,
} from "../types";

export function useInventoryModule() {
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


  return {
    subTab,
    setSubTab,
    historyView,
    setHistoryView,
    activeWarehouse,
    showZeroFloorItems,
    setShowZeroFloorItems,
    quickStockFilter,
    setQuickStockFilter,
    showScannerPanel,
    setShowScannerPanel,
    products,
    categories,
    movements,
    reportRows,
    importsList,
    expandedImportId,
    setExpandedImportId,
    search,
    setSearch,
    categoryId,
    setCategoryId,
    brandFilter,
    setBrandFilter,
    brandOptions,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    movementType,
    setMovementType,
    setProdPage,
    prodPageSize,
    setProdPageSize,
    setReportPage,
    reportPageSize,
    setReportPageSize,
    setMovPage,
    movPageSize,
    setMovPageSize,
    setImpPage,
    impPageSize,
    setImpPageSize,
    editingNames,
    editingNotes,
    editingCats,
    editingFloor1,
    editingFloor2,
    editingCosts,
    editingPrices,
    showAdminImportModal,
    setShowAdminImportModal,
    adminImportNote,
    setAdminImportNote,
    newProdCatId,
    newProdWarehouse,
    setNewProdWarehouse,
    adminImportRows,
    setAdminImportRows,
    activeAdminSuggestRowIdx,
    setActiveAdminSuggestRowIdx,
    adminSuggestHighlightIdx,
    setAdminSuggestHighlightIdx,
    importFilterCatId,
    setImportFilterCatId,
    importFilterBrandId,
    setImportFilterBrandId,
    importingAdminFile,
    submittingAdminImport,
    setAdminFileImportMode,
    adminFileInputRef,
    allCatalogProducts,
    showCodeCreator,
    setShowCodeCreator,
    editingProductModal,
    setEditingProductModal,
    canSeeCost,
    catalogByCode,
    variantCodeFor,
    expandedVariantProdId,
    setExpandedVariantProdId,
    cmsVarColorFilter,
    setCmsVarColorFilter,
    cmsVarSearch,
    setCmsVarSearch,
    editingVariants,
    setEditingVariants,
    newVariantInputs,
    setNewVariantInputs,
    savingVariantsProdId,
    showLabelModal,
    setShowLabelModal,
    labelItems,
    setLabelItems,
    setLinkModalProduct,
    setSetLinkModalProduct,
    setLinkMode,
    setSetLinkMode,
    selectedParentSetId,
    setSelectedParentSetId,
    packSizeInput,
    setPackSizeInput,
    setLinkSearch,
    setSetLinkSearch,
    setChildMode,
    setSetChildMode,
    selectedExistingRetailId,
    setSelectedExistingRetailId,
    newRetailName,
    setNewRetailName,
    newRetailUnit,
    setNewRetailUnit,
    newRetailSellingPrice,
    setNewRetailSellingPrice,
    modalUnpackCount,
    setModalUnpackCount,
    modalUnpackWarehouse,
    setModalUnpackWarehouse,
    savingSetLink,
    unpackingLoadingId,
    scannerEnabled,
    setScannerEnabled,
    scannerInput,
    setScannerInput,
    scannedCheckCounts,
    setScannedCheckCounts,
    scannedVariantCounts,
    setScannedVariantCounts,
    lastScannedProdId,
    setLastScannedProdId,
    lastScannedVariantCode,
    setLastScannedVariantCode,
    onlyShowScanned,
    setOnlyShowScanned,
    lastScanFeedback,
    setLastScanFeedback,
    transfersList,
    transferDirection,
    setTransferDirection,
    transferProductId,
    setTransferProductId,
    transferColor,
    setTransferColor,
    transferSize,
    setTransferSize,
    transferQty,
    setTransferQty,
    transferSearch,
    setTransferSearch,
    transferSuggestOpen,
    setTransferSuggestOpen,
    transferItems,
    setTransferItems,
    transferNote,
    setTransferNote,
    expandedTransferCode,
    setExpandedTransferCode,
    savingBatch,
    detailModalReceipt,
    setDetailModalReceipt,
    statusMsg,
    setStatusMsg,
    loadReport,
    handleSelectWarehouseTab,
    isProductChanged,
    changedProducts,
    handleResetProductEdits,
    handleSaveSingleProductRow,
    handleResetSingleProductRow,
    handleSaveAllProductChanges,
    handleDeleteProduct,
    handleDeleteImportReceipt,
    getAdminRowSuggestions,
    handleSelectAdminRowSuggestion,
    handleSelectAdminRowVariant,
    handleClearAdminRowProduct,
    handleUpdateAdminRow,
    handleAddAdminRow,
    handleDuplicateAdminRow,
    handleUpdateAdminRowColor,
    handleCodeCreatorDone,
    handleRemoveAdminRow,
    handleDownloadAdminSampleCsv,
    handleAdminImportFileChange,
    handleSubmitAdminBatchImport,
    handleSaveProductVariants,
    handleSaveVariantPrice,
    handleAddVariantToProduct,
    handleOpenPrintLabelForProduct,
    handleOpenPrintLabelsForDisplayed,
    sourceFloorProducts,
    getSourceFloorStock,
    getVariantSourceFloorStock,
    getProductSourceVariants,
    getSourceVariantFloorStock,
    getTransferItemKey,
    handleSelectTransferProduct,
    handleChangeTransferDirection,
    handleAddTransferItem,
    handleUpdateTransferItemVariant,
    handleUpdateTransferItemQty,
    handleRemoveTransferItem,
    handleCreateTransfer,
    handleOpenSetLinkModal,
    handleQuickUnpackSet,
    handleSaveSetLink,
    handleClearSetLink,
    displayedProducts,
    totalFloor1Qty,
    totalFloor2Qty,
    totalStockQty,
    totalCostInventoryValue,
    totalSellInventoryValue,
    productByCode,
    activeWarehouseLabel,
    prodTotalPages,
    safeProdPage,
    pagedProducts,
    handleBarcodeScanInCms,
    filteredReportRows,
    reportTotalPages,
    safeReportPage,
    pagedReportRows,
    filteredMovements,
    movTotalPages,
    safeMovPage,
    pagedMovements,
    filteredImports,
    impTotalPages,
    safeImpPage,
    pagedImports,
    renderPaginationBar,
  };
}

export type InventoryViewModel = ReturnType<typeof useInventoryModule>;
