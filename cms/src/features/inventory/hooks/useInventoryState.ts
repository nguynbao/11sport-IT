import { getStoredUser } from "@/shared/api/client";
import { DEBOUNCE_MS } from "@/config/listing";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { Brand,Category,InventoryReportRow,Product,ProductVariant,StockMovement,WarehouseFloor } from "@/shared/types";
import { BarcodeLabelItem } from "@/shared/ui/BarcodeLabelModal";
import { useEffect,useRef,useState } from "react";
import {
ActiveWarehouseTab,
AdminImportRow,
HistoryView,
QuickStockFilter,
SubTab
} from "../types";


export function useInventoryState() {
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
  const debouncedSearch = useDebounce(search, DEBOUNCE_MS.API);
  const debouncedTransferSearch = useDebounce(transferSearch, DEBOUNCE_MS.LOCAL);

  return {
    subTab,
    setSubTab,
    historyView,
    setHistoryView,
    activeWarehouse,
    setActiveWarehouse,
    showZeroFloorItems,
    setShowZeroFloorItems,
    quickStockFilter,
    setQuickStockFilter,
    showScannerPanel,
    setShowScannerPanel,
    products,
    setProducts,
    categories,
    setCategories,
    movements,
    setMovements,
    reportRows,
    setReportRows,
    importsList,
    setImportsList,
    expandedImportId,
    setExpandedImportId,
    search,
    setSearch,
    categoryId,
    setCategoryId,
    brandFilter,
    setBrandFilter,
    brandOptions,
    setBrandOptions,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    movementType,
    setMovementType,
    prodPage,
    setProdPage,
    prodPageSize,
    setProdPageSize,
    reportPage,
    setReportPage,
    reportPageSize,
    setReportPageSize,
    movPage,
    setMovPage,
    movPageSize,
    setMovPageSize,
    impPage,
    setImpPage,
    impPageSize,
    setImpPageSize,
    editingNames,
    setEditingNames,
    editingNotes,
    setEditingNotes,
    editingCats,
    setEditingCats,
    editingUnits,
    setEditingUnits,
    editingFloor1,
    setEditingFloor1,
    editingFloor2,
    setEditingFloor2,
    editingCosts,
    setEditingCosts,
    editingPrices,
    setEditingPrices,
    showAdminImportModal,
    setShowAdminImportModal,
    adminImportNote,
    setAdminImportNote,
    newProdCatId,
    setNewProdCatId,
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
    setImportingAdminFile,
    submittingAdminImport,
    setSubmittingAdminImport,
    submittingImportRef,
    adminFileImportMode,
    setAdminFileImportMode,
    adminFileInputRef,
    allCatalogProducts,
    setAllCatalogProducts,
    showCodeCreator,
    setShowCodeCreator,
    editingProductModal,
    setEditingProductModal,
    canSeeCost,
    setCanSeeCost,
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
    setSavingVariantsProdId,
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
    setSavingSetLink,
    unpackingLoadingId,
    setUnpackingLoadingId,
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
    setTransfersList,
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
    setSavingBatch,
    detailModalReceipt,
    setDetailModalReceipt,
    statusMsg,
    setStatusMsg,
    loading,
    setLoading,
    debouncedSearch,
    debouncedTransferSearch,
  };
}

export type InventoryState = ReturnType<typeof useInventoryState>;
