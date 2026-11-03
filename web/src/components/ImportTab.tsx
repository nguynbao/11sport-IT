"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ImportReceipt,
  ImportItem,
  Category,
  Product,
  WarehouseFloor,
  apiRequest,
  generateProductCode,
  generateVariantProductCode,
  extractVariantFromText,
  formatDateTime,
  formatVND,
  formatNumberDots,
  parseNumberDots,
  getStoredUser,
  useDebounce,
  filterAndRankBySearch,
} from "@/lib/api";
import BarcodeLabelModal, { BarcodeLabelItem } from "./BarcodeLabelModal";
import {
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Search,
  AlertTriangle,
  FilePlus,
  Lock,
  CheckSquare,
  ListChecks,
  ChevronDown,
  FileText,
  Eye,
  UserCheck,
  X,
  History,
  Upload,
  Download,
  Printer,
  CopyPlus,
  ScanLine,
  Zap,
  Undo2,
  ScanBarcode,
} from "lucide-react";
import {
  cleanBarcodeCode,
  findProductAndVariantByScannedBarcode,
  findProductByScannedBarcode,
  getBarcodeCandidates,
  isScannedCodeMatch,
  playScannerBeep,
  useHardwareBarcodeScanner,
} from "@/lib/barcodeScanner";

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

function normalizeActorRole(role?: string, name?: string, userId?: any): "ADMIN" | "WAREHOUSE" {
  const r = String(role || "").toUpperCase();
  if (r === "ADMIN") return "ADMIN";
  if (r === "WAREHOUSE") return "WAREHOUSE";
  const uid = typeof userId === "string" ? userId.toUpperCase() : "";
  if (uid === "ADMIN") return "ADMIN";
  const n = String(name || "").toLowerCase();
  if (n.includes("admin") || n.includes("quản trị") || n.includes("quản lý")) return "ADMIN";
  return "WAREHOUSE";
}

function RoleBadge({ role, name, userId }: { role?: string; name?: string; userId?: any }) {
  const resolved = normalizeActorRole(role, name, userId);
  if (resolved === "ADMIN") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap">
        ADMIN (Quản lý)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-100 text-teal-800 border border-teal-200 whitespace-nowrap">
      WAREHOUSE (Thủ kho)
    </span>
  );
}

export default function ImportTab() {
  const [receipts, setReceipts] = useState<ImportReceipt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [currentReceipt, setCurrentReceipt] = useState<ImportReceipt | null>(null);

  // Gợi ý tên sản phẩm có trong kho khi gõ ở từng dòng
  const [activeSuggestRowIdx, setActiveSuggestRowIdx] = useState<number | null>(null);
  const [suggestHighlightIdx, setSuggestHighlightIdx] = useState<number>(0);

  // Dropdown chọn phiếu nhập
  const [receiptDropdownOpen, setReceiptDropdownOpen] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileImportMode, setFileImportMode] = useState<"replace" | "append">("replace");
  const [importingFile, setImportingFile] = useState(false);

  // Modal in tem nhãn mã vạch (Label Printer)
  const [labelModalItems, setLabelModalItems] = useState<BarcodeLabelItem[] | null>(null);

  // State form chỉnh sửa phiếu
  const [note, setNote] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [targetWarehouse, setTargetWarehouse] = useState<WarehouseFloor>("FLOOR_1");
  const [items, setItems] = useState<ImportItem[]>([
    {
      stt: 1,
      productName: "",
      productCode: "",
      brand: "",
      color: "",
      size: "",
      unit: "Cái",
      expectedQuantity: 1,
      actualQuantity: 0,
      costPrice: 0,
      sellingPrice: 0,
      note: "",
      isChecked: false,
      isConfirmed: false,
      discrepancyNote: "",
    },
  ]);

  // Tìm kiếm nhanh trong phiếu
  const [quickCheckSearch, setQuickCheckSearch] = useState("");

  // Máy quét mã vạch (Label Barcode Scanner) cho Quét Kiểm Hàng Nhập Kho
  const [scannerEnabled, setScannerEnabled] = useState<boolean>(true);
  const [scannerInput, setScannerInput] = useState<string>("");
  const [multiRowScanMode, setMultiRowScanMode] = useState<"PICK" | "AUTO_NEXT">("PICK");
  const [lastScannedRowIdx, setLastScannedRowIdx] = useState<number | null>(null);
  const [lastUndoRowIdx, setLastUndoRowIdx] = useState<number | null>(null);
  const [scanCandidateRowIndices, setScanCandidateRowIndices] = useState<number[] | null>(null);
  const [lastScanFeedback, setLastScanFeedback] = useState<{
    type: "success" | "warning" | "error";
    code: string;
    message: string;
    time: string;
  } | null>(null);

  // Modal & mục xem lại chi tiết khi nhập hàng vào kho
  const [detailModalReceipt, setDetailModalReceipt] = useState<ImportReceipt | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    "ALL" | "COMPLETED" | "CHECKING" | "DRAFT"
  >("ALL");
  const [historyRoleFilter, setHistoryRoleFilter] = useState<"ALL" | "ADMIN" | "WAREHOUSE">("ALL");

  const currentUser = getStoredUser();

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      const [impRes, catRes, prodRes] = await Promise.all([
        apiRequest<ImportReceipt[]>("/imports"),
        apiRequest<Category[]>("/categories"),
        apiRequest<Product[]>("/products"),
      ]);
      const impList = Array.isArray(impRes.data) ? impRes.data : [];
      const catList = Array.isArray(catRes.data) ? catRes.data : [];
      const prodList = Array.isArray(prodRes.data) ? prodRes.data : [];
      setReceipts(impList);
      setCategories(catList);
      setCatalogProducts(prodList);
      if (catList.length > 0 && !defaultCategoryId) {
        const firstCatId = catList[0]._id;
        setDefaultCategoryId(firstCatId);
        setItems((prev) =>
          prev.map((it) => (it.categoryId ? it : { ...it, categoryId: firstCatId }))
        );
      }
    } catch {
      // ignore
    }
  }, [defaultCategoryId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setReceiptDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectReceipt = (rc: ImportReceipt) => {
    setCurrentReceipt(rc);
    setNote(rc.note || "");
    const activeCatId = rc.defaultCategoryId || categories[0]?._id || "";
    setDefaultCategoryId(activeCatId);
    setTargetWarehouse(rc.targetWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1");
    setItems(
      (rc.items || []).map((it, idx) => {
        const cat = categories.find((c) => c._id === String(it.categoryId || activeCatId));
        const extracted = extractVariantFromText(it.productName || "", {
          categoryCode: cat?.code,
          categoryName: cat?.name,
          brand: it.brand,
          existingCode: it.productCode,
        });
        return {
          stt: idx + 1,
          productCode:
            it.productCode ||
            extracted.code ||
            generateProductCode(it.productName, {
              categoryCode: cat?.code,
              categoryName: cat?.name,
              brand: it.brand,
            }),
          productName: it.productName,
          brand: it.brand || extracted.brand || "",
          color: it.color !== undefined ? it.color : extracted.color,
          size: it.size !== undefined ? it.size : extracted.size,
          categoryId: String(it.categoryId || activeCatId || ""),
          unit: it.unit || "Cái",
          expectedQuantity: Number(it.expectedQuantity || 0),
          actualQuantity: Number(it.actualQuantity ?? 0),
          costPrice: Number(it.costPrice || 0),
          sellingPrice: Number(it.sellingPrice || 0),
          scannedQuantity: Number(it.scannedQuantity || 0),
          checkedBy: it.checkedBy,
          checkedByName: it.checkedByName,
          checkedByRole: it.checkedByRole,
          checkedAt: it.checkedAt,
          scanCounts: it.scanCounts,
          barcode: it.barcode || it.productCode,
          note: it.note || "",
          isChecked: Boolean(it.isChecked),
          isConfirmed: Boolean(it.isConfirmed),
          discrepancyNote: it.discrepancyNote || "",
        };
      })
    );
    setStatusMsg(null);
    setReceiptDropdownOpen(false);
  };

  const handleStartNewReceipt = () => {
    setCurrentReceipt(null);
    setNote("");
    setTargetWarehouse("FLOOR_1");
    const initCatId = defaultCategoryId || categories[0]?._id || "";
    setItems([
      {
        stt: 1,
        productName: "",
        productCode: "",
        brand: "",
        categoryId: initCatId,
        color: "",
        size: "",
        unit: "Cái",
        expectedQuantity: 1,
        actualQuantity: 0,
        costPrice: 0,
        sellingPrice: 0,
        note: "",
        isChecked: false,
        isConfirmed: false,
        discrepancyNote: "",
      },
    ]);
    setStatusMsg(null);
    setReceiptDropdownOpen(false);
  };

  const isCompleted = currentReceipt?.status === "COMPLETED";
  const currentStepStatus = currentReceipt?.status || "DRAFT";

  // Cập nhật từng ô trong bảng (Tự sinh MÃ HÀNG = [Chữ cái đầu Cate][Tên Hãng/NN][6 chữ số] + đồng bộ giá theo mã chung)
  const handleUpdateRow = (index: number, field: keyof ImportItem, value: any) => {
    if (isCompleted) return;
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      const cat = categories.find((c) => c._id === String(item.categoryId || defaultCategoryId));

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

      if (field === "expectedQuantity") {
        const exp = Math.max(0, Math.round(Number(value) || 0));
        item.expectedQuantity = exp;
        const actual = Math.max(0, Math.round(Number(item.actualQuantity) || 0));
        const diff = actual - exp;
        item.discrepancyNote =
          diff === 0
            ? "Khớp đủ"
            : diff > 0
              ? `Thừa ${diff} ${item.unit || "Cái"}`
              : `Thiếu ${Math.abs(diff)} ${item.unit || "Cái"}`;
      }

      if (field === "actualQuantity") {
        const actual = Math.max(0, Math.round(Number(value) || 0));
        const exp = Math.max(0, Math.round(Number(item.expectedQuantity) || 0));
        item.actualQuantity = actual;
        item.isChecked = true;
        const diff = actual - exp;
        item.discrepancyNote =
          diff === 0
            ? "Khớp đủ"
            : diff > 0
              ? `Thừa ${diff} ${item.unit || "Cái"}`
              : `Thiếu ${Math.abs(diff)} ${item.unit || "Cái"}`;
      }

      next[index] = item;

      // Đồng bộ 1 Giá gốc & 1 Giá bán cho tất cả các dòng (biến thể Màu/Size) có cùng Mã sản phẩm chung
      if ((field === "costPrice" || field === "sellingPrice") && item.productCode) {
        for (let i = 0; i < next.length; i++) {
          if (i !== index && next[i].productCode === item.productCode) {
            next[i] = {
              ...next[i],
              [field]: value,
            };
          }
        }
      }

      return next;
    });
  };

  // Nhân bản nhanh 1 dòng để thêm Size / Màu khác cho cùng Mã sản phẩm
  const handleDuplicateRowForVariant = (index: number) => {
    if (isCompleted) return;
    setItems((prev) => {
      const source = prev[index];
      if (!source) return prev;
      const cloned: ImportItem = {
        ...source,
        color: source.color || "",
        size: "",
        expectedQuantity: source.expectedQuantity || 1,
        actualQuantity: 0,
        isChecked: false,
        isConfirmed: false,
        discrepancyNote: "",
      };
      const next = [...prev.slice(0, index + 1), cloned, ...prev.slice(index + 1)];
      return next.map((it, idx) => ({ ...it, stt: idx + 1 }));
    });
  };

  /**
   * Cộng (+1) hoặc hoàn tác (-1) SL Thực Nhận cho 1 dòng trong Phiếu Nhập Kho khi quét mã vạch.
   */
  const applyScanDeltaToRow = (targetIdx: number, delta: 1 | -1 = 1, _sourceNote?: string) => {
    if (isCompleted) return;
    const targetRow = items[targetIdx];
    if (!targetRow) return;

    const nowStr = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const exp = Math.max(0, Math.round(Number(targetRow.expectedQuantity) || 0));
    const curActual = Math.max(0, Math.round(Number(targetRow.actualQuantity) || 0));
    const nextActual = Math.max(0, curActual + delta);
    const diff = nextActual - exp;
    const discNote =
      diff === 0
        ? "Khớp đủ"
        : diff > 0
          ? `Thừa ${diff} ${targetRow.unit || "Cái"}`
          : `Thiếu ${Math.abs(diff)} ${targetRow.unit || "Cái"}`;

    setItems((prev) => {
      const next = [...prev];
      const row = next[targetIdx];
      if (!row) return prev;
      next[targetIdx] = {
        ...row,
        actualQuantity: nextActual,
        scannedQuantity: nextActual,
        isChecked: nextActual > 0,
        isConfirmed: nextActual > 0 ? true : row.isConfirmed,
        discrepancyNote: discNote,
      };
      return next;
    });

    setLastScannedRowIdx(targetIdx);
    if (delta === 1) {
      setLastUndoRowIdx(targetIdx);
    } else {
      setLastUndoRowIdx(null);
    }
    setScanCandidateRowIndices(null);

    const variantDesc = [targetRow.color, targetRow.size ? `Size ${targetRow.size}` : ""]
      .filter(Boolean)
      .join(" • ");

    if (delta === -1) {
      playScannerBeep("warning");
      setLastScanFeedback({
        type: "warning",
        code: targetRow.productCode,
        message: `Đã hoàn tác (-1) dòng #${targetIdx + 1} "${targetRow.productName}"${
          variantDesc ? ` (${variantDesc})` : ""
        } → SL Thực nhận: ${nextActual}/${exp}`,
        time: nowStr,
      });
      return;
    }

    if (exp > 0 && nextActual > exp) {
      playScannerBeep("warning");
      setLastScanFeedback({
        type: "warning",
        code: targetRow.productCode,
        message: `⚠️ Vượt SL Dự kiến! Dòng #${targetIdx + 1} "${targetRow.productName}"${
          variantDesc ? ` (${variantDesc})` : ""
        } → SL Thực nhận: ${nextActual}/${exp} (${discNote})`,
        time: nowStr,
      });
    } else {
      playScannerBeep("success");
      setLastScanFeedback({
        type: "success",
        code: targetRow.productCode,
        message: `✅ +1 Dòng #${targetIdx + 1} "${targetRow.productName}"${
          variantDesc ? ` (${variantDesc})` : ""
        } → SL Thực nhận: ${nextActual}/${exp} (${
          nextActual === exp ? "ĐÃ KHỚP ĐỦ" : `Còn thiếu ${exp - nextActual}`
        })`,
        time: nowStr,
      });
    }
  };

  /**
   * Xử lý khi Máy Quét Label bắn mã sản phẩm trong màn hình Nhập Kho (Quét kiểm hàng):
   * - Khử lỗi bộ gõ Tiếng Việt (Unikey Telex).
   * - Tìm tất cả các dòng trong phiếu nhập khớp với Mã SP vừa quét.
   * - Nếu khớp 1 dòng: tự động cộng +1 vào SL Thực Nhận & Tick xác nhận.
   * - Nếu khớp nhiều dòng (nhiều Màu/Size): mở khung chọn nhanh dòng (bấm phím 1..9) hoặc tự cộng vào dòng chưa đủ.
   * - Nếu mã chưa có trong phiếu nhưng có trong Danh mục Kho: tự động thêm dòng sản phẩm đó vào phiếu với SL Thực nhận = 1.
   */
  const handleBarcodeScanForImportCheck = (rawInput: string) => {
    if (isCompleted) return;
    const trimmed = String(rawInput || "").trim();
    if (!trimmed) return;

    const nowStr = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const candidates = getBarcodeCandidates(trimmed);
    const displayCode =
      candidates[1] || candidates[0] || cleanBarcodeCode(trimmed) || trimmed.toUpperCase();

    // 1. Ưu tiên khớp chính xác theo Mã con thuộc tính (variantCode = Root + Màu + Size)
    const exactChildIndices: number[] = [];
    items.forEach((it, idx) => {
      if (it.productName.trim() === "") return;
      const childCode =
        it.variantCode || generateVariantProductCode(it.productCode, it.color, it.size);
      if (
        (it.color || it.size) &&
        isScannedCodeMatch(trimmed, childCode, it.barcode)
      ) {
        exactChildIndices.push(idx);
      }
    });

    const matchedIndices: number[] = [...exactChildIndices];
    if (matchedIndices.length === 0) {
      items.forEach((it, idx) => {
        if (
          it.productName.trim() !== "" &&
          isScannedCodeMatch(trimmed, it.productCode, it.barcode)
        ) {
          matchedIndices.push(idx);
        }
      });
    }

    // Kiểm tra hậu tố Màu/Size nếu có (VD: GASIA221401-41)
    const parts = trimmed.split(/[-_/:|\s]+/);
    if (matchedIndices.length === 0 && parts.length > 1 && parts[0].length >= 4) {
      const basePart = parts[0];
      const suffixNorm = cleanBarcodeCode(parts.slice(1).join(""));
      items.forEach((it, idx) => {
        if (
          it.productName.trim() !== "" &&
          isScannedCodeMatch(basePart, it.productCode, it.barcode)
        ) {
          const rowSize = cleanBarcodeCode(it.size || "");
          const rowColor = cleanBarcodeCode(it.color || "");
          if (
            !suffixNorm ||
            suffixNorm === rowSize ||
            suffixNorm === rowColor ||
            suffixNorm === cleanBarcodeCode(`${it.color || ""}${it.size || ""}`)
          ) {
            matchedIndices.push(idx);
          }
        }
      });
    }

    if (matchedIndices.length === 1) {
      applyScanDeltaToRow(matchedIndices[0], 1);
      return;
    }

    if (matchedIndices.length > 1) {
      if (multiRowScanMode === "AUTO_NEXT") {
        const firstUnfull = matchedIndices.find(
          (idx) =>
            (Number(items[idx].actualQuantity) || 0) <
            Math.max(1, Number(items[idx].expectedQuantity) || 1)
        );
        const chosenIdx = firstUnfull !== undefined ? firstUnfull : matchedIndices[0];
        applyScanDeltaToRow(chosenIdx, 1);
        return;
      }

      playScannerBeep("warning");
      setScanCandidateRowIndices(matchedIndices);
      setLastScanFeedback({
        type: "warning",
        code: items[matchedIndices[0]]?.productCode || displayCode,
        message: `Mã ${
          items[matchedIndices[0]]?.productCode || displayCode
        } có ${matchedIndices.length} dòng phân loại (Màu/Size) trong phiếu — Bấm phím số [1..${matchedIndices.length}] hoặc click chọn dòng vừa kiểm!`,
        time: nowStr,
      });
      return;
    }

    // 2. Nếu chưa có trong phiếu nhập, thử tìm trong Danh mục sản phẩm kho (hỗ trợ cả Mã con & Mã gốc) để tự động thêm vào phiếu
    const catalogScan = findProductAndVariantByScannedBarcode(catalogProducts, trimmed);
    if (catalogScan) {
      const { product: catalogProd, matchedVariant } = catalogScan;
      const catId =
        typeof catalogProd.categoryId === "object"
          ? catalogProd.categoryId?._id || defaultCategoryId
          : String(catalogProd.categoryId || defaultCategoryId);
      const pickedVariant = matchedVariant || (catalogProd.variants || [])[0];
      const rowColor = pickedVariant?.color || catalogProd.color || "";
      const rowSize = pickedVariant?.size || catalogProd.size || "";
      const childCode = generateVariantProductCode(catalogProd.code, rowColor, rowSize);
      const newRow: ImportItem = {
        stt: 1,
        productCode: catalogProd.code,
        variantCode: childCode,
        productName: catalogProd.name,
        brand: catalogProd.brand || "",
        categoryId: catId,
        color: rowColor,
        size: rowSize,
        unit: catalogProd.unit || "Cái",
        expectedQuantity: 1,
        actualQuantity: 1,
        scannedQuantity: 1,
        costPrice: Number(catalogProd.costPrice || 0),
        sellingPrice: Number(catalogProd.sellingPrice || 0),
        barcode: childCode,
        note: "",
        isChecked: true,
        isConfirmed: true,
        discrepancyNote: "Khớp đủ",
      };

      setItems((prev) => {
        const hasOnlyEmptyFirst =
          prev.length === 1 && prev[0].productName.trim() === "" && !prev[0].productCode.trim();
        const next = hasOnlyEmptyFirst ? [newRow] : [...prev, newRow];
        const finalNext = next.map((it, i) => ({ ...it, stt: i + 1 }));
        setLastScannedRowIdx(finalNext.length - 1);
        setLastUndoRowIdx(finalNext.length - 1);
        return finalNext;
      });

      playScannerBeep("success");
      setLastScanFeedback({
        type: "success",
        code: catalogProd.code,
        message: `✅ Đã quét mã ${catalogProd.code} ("${catalogProd.name}") — Tự động thêm vào phiếu nhập với SL Thực nhận = 1!`,
        time: nowStr,
      });
      return;
    }

    // 3. Không có trong phiếu nhập và cũng không có trong Danh mục kho
    playScannerBeep("error");
    setLastScanFeedback({
      type: "error",
      code: displayCode,
      message: `❌ Mã "${displayCode}" không có trong Phiếu nhập hiện tại và chưa có trong Danh mục Kho!`,
      time: nowStr,
    });
  };

  useHardwareBarcodeScanner({
    enabled: scannerEnabled && !isCompleted && !Boolean(labelModalItems) && !Boolean(detailModalReceipt),
    onScan: (scannedCode) => {
      handleBarcodeScanForImportCheck(scannedCode);
    },
  });

  // Phím tắt [1..9] khi đang mở bảng chọn dòng trùng Mã SP trong phiếu nhập
  useEffect(() => {
    if (!scanCandidateRowIndices || scanCandidateRowIndices.length === 0 || typeof window === "undefined") {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase() || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") {
        e.preventDefault();
        setScanCandidateRowIndices(null);
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const pickPos = Number(e.key) - 1;
        const rowIdx = scanCandidateRowIndices[pickPos];
        if (rowIdx !== undefined) {
          e.preventDefault();
          applyScanDeltaToRow(rowIdx, 1);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Tải file Excel/CSV mẫu để nhập kho
  const handleDownloadSampleCsv = () => {
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

  // Xử lý khi người dùng chọn file PDF / Excel (.xlsx, .csv, .pdf)
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportingFile(true);
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
        items: ImportItem[];
        totalRows: number;
        totalQuantity: number;
      }>("/imports/parse-file", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          contentBase64: base64,
          defaultCategoryId: defaultCategoryId || undefined,
        }),
      });

      const parsedItems = Array.isArray(res.data?.items) ? res.data.items : [];
      if (parsedItems.length === 0) {
        setStatusMsg({
          type: "warning",
          text: `Không tìm thấy dòng sản phẩm hợp lệ trong file "${file.name}". Vui lòng kiểm tra cột Tên sản phẩm / Số lượng hoặc tải File Mẫu.`,
        });
        return;
      }

      setItems((prev) => {
        const existingValid = prev.filter((i) => i.productName.trim() !== "");
        const combined =
          fileImportMode === "append" && existingValid.length > 0
            ? [...existingValid, ...parsedItems]
            : parsedItems;
        const cat = categories.find((c) => c._id === String(defaultCategoryId));
        return combined.map((it, idx) => ({
          ...it,
          stt: idx + 1,
          productCode:
            it.productCode ||
            generateProductCode(it.productName, {
              categoryCode: cat?.code,
              categoryName: cat?.name,
              brand: it.brand,
            }),
          brand: it.brand || "",
          color: it.color || "",
          size: (it.size || "").toUpperCase(),
          actualQuantity: 0,
          isChecked: false,
          isConfirmed: false,
          discrepancyNote: "",
        }));
      });

      if (!note.trim()) {
        setNote(`Nhập kho từ file ${file.name}`);
      }

      setStatusMsg({
        type: "success",
        text: `Đã bóc tách thành công ${parsedItems.length} dòng hàng (tổng ${res.data?.totalQuantity || 0} SP) từ file "${file.name}"! Bạn có thể kiểm tra Màu sắc, Size, Số lượng hoặc bấm In Tem Mã Vạch.`,
      });
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || `Lỗi khi đọc file "${file.name}".`,
      });
    } finally {
      setImportingFile(false);
    }
  };

  // Map tra cứu nhanh sản phẩm có sẵn trong kho theo mã code
  const catalogByCode = useMemo(() => {
    const map = new Map<string, Product>();
    catalogProducts.forEach((p) => {
      if (p.code) map.set(p.code, p);
    });
    return map;
  }, [catalogProducts]);

  const getRowProductSuggestions = useCallback(
    (query: string): Product[] => {
      const q = (query || "").trim();
      if (!q) {
        return catalogProducts.slice(0, 8);
      }
      const matched = filterAndRankBySearch(catalogProducts, q, (p) => [
        p.name,
        p.code,
        p.brand,
        p.categoryName,
      ]);
      return matched.slice(0, 8);
    },
    [catalogProducts]
  );

  const handleSelectSuggestedProduct = (rowIdx: number, prod: Product) => {
    if (isCompleted) return;
    setItems((prev) => {
      const next = [...prev];
      const cur = next[rowIdx];
      if (!cur) return prev;
      const catId =
        typeof prod.categoryId === "object"
          ? prod.categoryId?._id || defaultCategoryId
          : String(prod.categoryId || defaultCategoryId);
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
    setActiveSuggestRowIdx(null);
  };

  const validItemCount = useMemo(
    () => items.filter((i) => i.productName.trim() !== "").length,
    [items]
  );

  const hasReceiptChanges = useMemo(() => {
    if (isCompleted) return false;
    if (!currentReceipt) {
      return validItemCount > 0 || note.trim() !== "";
    }
    const origWarehouse = currentReceipt.targetWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1";
    if ((note || "").trim() !== (currentReceipt.note || "").trim()) return true;
    if (targetWarehouse !== origWarehouse) return true;
    if (
      defaultCategoryId &&
      currentReceipt.defaultCategoryId &&
      String(defaultCategoryId) !== String(currentReceipt.defaultCategoryId)
    ) {
      return true;
    }
    const origItems = currentReceipt.items || [];
    const currentValid = items.filter((i) => i.productName.trim() !== "");
    if (currentValid.length !== origItems.length) return true;
    for (let i = 0; i < currentValid.length; i++) {
      const cur = currentValid[i];
      const orig = origItems[i];
      if (!orig) return true;
      if ((cur.productName || "").trim() !== (orig.productName || "").trim()) return true;
      if ((cur.productCode || "").trim() !== (orig.productCode || "").trim()) return true;
      if ((cur.color || "").trim() !== (orig.color || "").trim()) return true;
      if ((cur.size || "").trim() !== (orig.size || "").trim()) return true;
      if ((cur.unit || "Cái").trim() !== (orig.unit || "Cái").trim()) return true;
      if (Number(cur.expectedQuantity || 0) !== Number(orig.expectedQuantity || 0)) return true;
      if (
        Number(cur.actualQuantity || 0) !==
        Number(orig.actualQuantity ?? orig.expectedQuantity ?? 0)
      )
        return true;
      if (Number(cur.costPrice || 0) !== Number(orig.costPrice || 0)) return true;
      if (Number(cur.sellingPrice || 0) !== Number(orig.sellingPrice || 0)) return true;
      if ((cur.note || "").trim() !== (orig.note || "").trim()) return true;
      if (Boolean(cur.isChecked) !== Boolean(orig.isChecked)) return true;
      if (Boolean(cur.isConfirmed) !== Boolean(orig.isConfirmed)) return true;
    }
    return false;
  }, [isCompleted, currentReceipt, validItemCount, note, targetWarehouse, defaultCategoryId, items]);

  const handleAddRow = () => {
    if (isCompleted) return;
    const initCatId = defaultCategoryId || categories[0]?._id || "";
    setItems((prev) => [
      ...prev,
      {
        stt: prev.length + 1,
        productName: "",
        productCode: "",
        brand: "",
        categoryId: prev[prev.length - 1]?.categoryId || initCatId,
        color: "",
        size: "",
        unit: "Cái",
        expectedQuantity: 1,
        actualQuantity: 0,
        costPrice: 0,
        sellingPrice: 0,
        note: "",
        isChecked: false,
        isConfirmed: false,
        discrepancyNote: "",
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (isCompleted) return;
    setItems((prev) =>
      prev.filter((_, i) => i !== index).map((it, idx) => ({ ...it, stt: idx + 1 }))
    );
  };

  // Lưu nháp phiếu nhập
  const handleSaveDraft = async (): Promise<ImportReceipt | null> => {
    setStatusMsg(null);
    const validItems = items
      .filter((i) => i.productName.trim() !== "")
      .map((it, idx) => {
        const cat = categories.find((c) => c._id === String(it.categoryId || defaultCategoryId));
        return {
          ...it,
          stt: idx + 1,
          productCode:
            it.productCode ||
            generateProductCode(it.productName, {
              categoryCode: cat?.code,
              categoryName: cat?.name,
              brand: it.brand,
            }),
          brand: (it.brand || "").trim(),
          color: (it.color || "").trim(),
          size: (it.size || "").trim().toUpperCase(),
          categoryId: it.categoryId || defaultCategoryId || undefined,
        };
      });

    if (validItems.length === 0) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng nhập hoặc import ít nhất 1 dòng hàng hợp lệ.",
      });
      return null;
    }

    setLoading(true);
    try {
      let saved: ImportReceipt;
      if (!currentReceipt?._id) {
        const res = await apiRequest<ImportReceipt>("/imports", {
          method: "POST",
          body: JSON.stringify({
            note,
            defaultCategoryId: defaultCategoryId || undefined,
            targetWarehouse,
            items: validItems,
          }),
        });
        saved = res.data;
      } else {
        const res = await apiRequest<ImportReceipt>(`/imports/${currentReceipt._id}`, {
          method: "PUT",
          body: JSON.stringify({
            note,
            defaultCategoryId: defaultCategoryId || undefined,
            targetWarehouse,
            items: validItems,
          }),
        });
        saved = res.data;
      }
      handleSelectReceipt(saved);
      await loadInitialData();
      setStatusMsg({
        type: "success",
        text: `Đã lưu nháp phiếu nhập ${saved.code || saved.receiptCode || ""} thành công!`,
      });
      return saved;
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Lỗi khi lưu nháp phiếu nhập.",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Hoàn thành nhập kho (Đẩy các dòng isConfirmed = true vào kho, gộp biến thể Màu/Size theo Mã chung và khóa phiếu)
  const handleCompleteImport = async () => {
    const confirmedCount = items.filter((i) => i.productName.trim() !== "" && i.isConfirmed).length;
    if (confirmedCount === 0) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng tick xác nhận ít nhất 1 dòng hàng trước khi bấm Hoàn thành Nhập Kho!",
      });
      return;
    }

    const saved = await handleSaveDraft();
    if (!saved?._id) return;

    setLoading(true);
    try {
      const res = await apiRequest<any>(`/imports/${saved._id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          defaultCategoryId: defaultCategoryId || undefined,
          targetWarehouse,
          items: saved.items,
        }),
      });
      const completedReceipt: ImportReceipt = res.data?.receipt || res.data;
      handleSelectReceipt(completedReceipt);
      await loadInitialData();
      setStatusMsg({
        type: "success",
        text: `HOÀN THÀNH NHẬP KHO (${targetWarehouse === "FLOOR_2" ? "Kho Tầng 2" : "Kho Tầng 1"
          })! Đã cộng tồn theo từng (Màu sắc, Size) vào Mã sản phẩm chung, ghi Sổ kho và khóa phiếu. Bạn có thể bấm "In Tem Mã Vạch" để xuất tem dán lên hàng.`,
      });
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Lỗi khi hoàn thành phiếu nhập kho.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReceipt = async (rc: ImportReceipt, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const code = rc.code || rc.receiptCode || rc._id.slice(-6);
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA phiếu nhập "${code}" không?`)) {
      return;
    }
    setLoading(true);
    setStatusMsg(null);
    try {
      await apiRequest(`/imports/${rc._id}`, { method: "DELETE" });
      if (currentReceipt?._id === rc._id) {
        handleStartNewReceipt();
      }
      await loadInitialData();
      setStatusMsg({
        type: "success",
        text: `Đã xóa phiếu nhập "${code}" thành công!`,
      });
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể xóa phiếu nhập kho.",
      });
    } finally {
      setLoading(false);
    }
  };

  const openPrintModalForCurrentItems = (sourceItems: ImportItem[]) => {
    const valid = sourceItems.filter((i) => i.productName.trim() !== "");
    if (valid.length === 0) {
      alert("Chưa có dòng sản phẩm nào trong phiếu để in tem mã vạch!");
      return;
    }
    setLabelModalItems(
      valid.map((it, idx) => {
        const baseCode = it.productCode || generateProductCode(it.productName);
        const childCode =
          it.variantCode || generateVariantProductCode(baseCode, it.color, it.size);
        return {
          id: `${childCode}_${idx}`,
          code: childCode,
          productCode: baseCode,
          productName: it.productName,
          color: it.color,
          size: it.size,
          sellingPrice: it.sellingPrice,
          unit: it.unit,
          defaultQty: Math.max(1, Number(it.actualQuantity || it.expectedQuantity || 1)),
        };
      })
    );
  };

  // Thống kê
  const totalRows = items.length;
  const checkedRows = items.filter((i) => i.isChecked).length;
  const confirmedRows = items.filter((i) => i.isConfirmed).length;
  const matchedRows = items.filter(
    (i) => i.isChecked && i.actualQuantity === i.expectedQuantity
  ).length;
  const shortageRows = items.filter(
    (i) => i.isChecked && i.actualQuantity < i.expectedQuantity
  ).length;
  const surplusRows = items.filter(
    (i) => i.isChecked && i.actualQuantity > i.expectedQuantity
  ).length;
  const totalCostValue = items.reduce(
    (sum, i) => sum + (Number(i.costPrice) || 0) * (Number(i.actualQuantity) || 0),
    0
  );
  const totalSellingValue = items.reduce(
    (sum, i) => sum + (Number(i.sellingPrice) || 0) * (Number(i.actualQuantity) || 0),
    0
  );
  const missingCostRows = items.filter(
    (i) => i.productName.trim() !== "" && !(Number(i.costPrice) > 0)
  ).length;
  const missingSellingRows = items.filter(
    (i) => i.productName.trim() !== "" && !(Number(i.sellingPrice) > 0)
  ).length;

  const debouncedQuickCheckSearch = useDebounce(quickCheckSearch, 300);
  const debouncedReceiptSearch = useDebounce(receiptSearch, 300);

  const filteredItems = useMemo(() => {
    const indexed = items.map((item, idx) => ({ item, idx }));
    if (!debouncedQuickCheckSearch.trim()) return indexed;
    return filterAndRankBySearch(indexed, debouncedQuickCheckSearch, ({ item }) => [
      { text: item.productCode, weight: 1.5 },
      { text: item.productName, weight: 1.3 },
      { text: item.color, weight: 1.1 },
      { text: item.size, weight: 1.1 },
      { text: item.note, weight: 0.8 },
    ]);
  }, [items, debouncedQuickCheckSearch]);

  const filteredReceipts = useMemo(() => {
    if (!debouncedReceiptSearch.trim()) return receipts;
    return filterAndRankBySearch(receipts, debouncedReceiptSearch, (rc) => [
      { text: rc.code || rc.receiptCode || rc._id, weight: 1.6 },
      { text: rc.note, weight: 1.1 },
      { text: rc.createdByName, weight: 0.9 },
      ...(rc.items || []).flatMap((it) => [
        { text: it.productCode, weight: 1.2 },
        { text: it.productName, weight: 1.1 },
        { text: it.color, weight: 1.0 },
        { text: it.size, weight: 1.0 },
      ]),
    ]);
  }, [receipts, debouncedReceiptSearch]);

  const currentReceiptCode = currentReceipt
    ? currentReceipt.code || currentReceipt.receiptCode || currentReceipt._id.slice(-6)
    : "";

  return (
    <div className="space-y-4">
      {/* Datalist gợi ý nhanh Màu sắc & Size */}
      <datalist id="import-color-suggestions">
        {COMMON_COLORS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="import-size-suggestions">
        {COMMON_SIZES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* Input ẩn dùng cho Upload PDF / Excel */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.tsv,.pdf"
        onChange={handleImportFileChange}
        className="hidden"
      />

      {/* Thanh Chọn Phiếu Nhập Kho & Quy trình Nhập Kho mới */}
      <div className="bg-slate-900 text-white rounded-xl p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase text-emerald-400">
              Quy trình Nhập Kho 11Sport • Import PDF/Excel & Máy In Tem Mã Vạch
            </span>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <h2 className="text-base sm:text-lg font-extrabold">
                {currentReceipt ? `Phiếu nhập: ${currentReceiptCode}` : "Soạn Phiếu Nhập Kho Mới"}
              </h2>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-extrabold ${currentStepStatus === "COMPLETED"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-blue-500 text-white"
                  }`}
              >
                Trạng thái:{" "}
                {currentStepStatus === "COMPLETED"
                  ? "ĐÃ HOÀN THÀNH (ĐÃ KHÓA)"
                  : "ĐANG SOẠN / KIỂM HÀNG"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-lg">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Người nhập:</span>
                <strong className="text-white">
                  {currentReceipt
                    ? currentReceipt.createdByName || "Thủ kho"
                    : currentUser?.fullName || "Thủ kho"}
                </strong>
                <RoleBadge
                  role={
                    currentReceipt ? currentReceipt.createdByRole : currentUser?.role || "WAREHOUSE"
                  }
                  name={currentReceipt ? currentReceipt.createdByName : currentUser?.fullName}
                  userId={currentReceipt?.createdBy}
                />
              </span>
              {currentReceipt?.status === "COMPLETED" && (
                <span className="inline-flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-700 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Hoàn thành bởi:</span>
                  <strong className="text-emerald-200">
                    {currentReceipt.completedByName || currentReceipt.createdByName || "Thủ kho"}
                  </strong>
                  <RoleBadge
                    role={currentReceipt.completedByRole || currentReceipt.createdByRole}
                    name={currentReceipt.completedByName || currentReceipt.createdByName}
                    userId={currentReceipt.completedBy || currentReceipt.createdBy}
                  />
                </span>
              )}
              {currentReceipt && (
                <button
                  type="button"
                  onClick={() => setDetailModalReceipt(currentReceipt)}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-lg transition shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Xem lại chi tiết phiếu
                </button>
              )}
            </div>
          </div>

          {/* Khu vực Dropdown Danh sách Phiếu Nhập + Nút Tạo mới */}
          <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
            <div className="relative flex-1 sm:flex-initial min-w-[280px] sm:min-w-[380px]">
              <button
                type="button"
                onClick={() => setReceiptDropdownOpen((prev) => !prev)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-emerald-500/60 text-left flex items-center justify-between gap-2 transition shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Danh sách Phiếu Nhập ({receipts.length})
                    </div>
                    {currentReceipt ? (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-white truncate">
                        <span className="font-mono text-emerald-400">{currentReceiptCode}</span>
                        <span>•</span>
                        <span className="text-slate-200 truncate max-w-[180px] sm:max-w-[240px]">
                          {currentReceipt.note || "Phiếu nhập kho"}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-200">
                          {currentReceipt.items?.length || 0} dòng
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-emerald-400">
                        + Đang soạn Phiếu Nhập Mới (Chưa lưu)
                      </div>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${receiptDropdownOpen ? "rotate-180 text-emerald-400" : ""
                    }`}
                />
              </button>

              {receiptDropdownOpen && (
                <div className="absolute right-0 left-0 sm:left-auto sm:w-[480px] mt-2 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 z-40 overflow-hidden">
                  <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={receiptSearch}
                        onChange={(e) => setReceiptSearch(e.target.value)}
                        placeholder="Tìm mã phiếu hoặc ghi chú..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleStartNewReceipt}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shrink-0"
                    >
                      <FilePlus className="w-3.5 h-3.5" /> Tạo phiếu mới
                    </button>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                    {filteredReceipts.length === 0 ? (
                      <div className="text-xs text-slate-400 text-center py-6">
                        Không tìm thấy phiếu nhập nào
                      </div>
                    ) : (
                      filteredReceipts.map((rc) => {
                        const code = rc.code || rc.receiptCode || rc._id.slice(-6);
                        const isSelected = currentReceipt?._id === rc._id;
                        return (
                          <div
                            key={rc._id}
                            onClick={() => handleSelectReceipt(rc)}
                            className={`p-3 cursor-pointer transition hover:bg-slate-50 ${isSelected ? "bg-emerald-50/80 border-l-4 border-l-emerald-600" : ""
                              }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono font-extrabold text-xs text-slate-900">
                                  {code}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rc.status === "COMPLETED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-blue-100 text-blue-800"
                                    }`}
                                >
                                  {rc.status === "COMPLETED" ? "HOÀN THÀNH" : "NHÁP"}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${rc.targetWarehouse === "FLOOR_2"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-indigo-100 text-indigo-800"
                                    }`}
                                >
                                  {rc.targetWarehouse === "FLOOR_2"
                                    ? "🏬 Kho Tầng 2"
                                    : "🏢 Kho Tầng 1"}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  {rc.items?.length || 0} dòng
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailModalReceipt(rc);
                                    setReceiptDropdownOpen(false);
                                  }}
                                  className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" /> Chi tiết
                                </button>
                                {rc.status !== "COMPLETED" && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteReceipt(rc, e)}
                                    className="p-1 rounded hover:bg-red-50 text-red-500"
                                    title="Xóa phiếu nhập"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="text-xs text-slate-700 mt-1 break-words">
                              {rc.note || "Phiếu nhập kho"}
                            </div>

                            <div className="text-[11px] text-slate-500 mt-1.5 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span>Người nhập:</span>
                                <strong className="text-slate-800">
                                  {rc.createdByName || "Thủ kho"}
                                </strong>
                                <RoleBadge
                                  role={rc.createdByRole}
                                  name={rc.createdByName}
                                  userId={rc.createdBy}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span>{formatDateTime(rc.createdAt)}</span>
                                {isSelected && (
                                  <span className="text-emerald-700 font-bold">Đang mở</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleStartNewReceipt}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition shrink-0"
            >
              <FilePlus className="w-4 h-4" /> Tạo mới
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-lg border border-emerald-400/60 bg-slate-800">
            <div className="font-bold text-emerald-400">Bước 1: Import PDF / Excel</div>
            <div className="text-slate-300 text-[11px]">
              Tải file .xlsx, .csv hoặc .pdf lên để bóc tách tự động thông tin hàng
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-700 bg-slate-800/60">
            <div className="font-bold text-amber-400">Bước 2: Kiểm tra Màu • Size • SL</div>
            <div className="text-slate-300 text-[11px]">
              Thêm/chỉnh Màu sắc, Size, Số lượng và Giá gốc / Giá bán
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-700 bg-slate-800/60">
            <div className="font-bold text-blue-400">Bước 3: Hoàn thành Nhập Kho</div>
            <div className="text-slate-300 text-[11px]">
              Gộp biến thể Màu/Size vào 1 Mã SP chung & cộng tồn kho
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-700 bg-slate-800/60">
            <div className="font-bold text-purple-300">Bước 4: Xuất Mã Vạch (Máy In Label)</div>
            <div className="text-slate-300 text-[11px]">
              In tem nhãn Code128 theo <b>Mã con từng thuộc tính</b> (VD: GASIA221401DO38)
            </div>
          </div>
        </div>
      </div>

      {/* Thông báo trạng thái */}
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${statusMsg.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : statusMsg.type === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-red-50 border-red-200 text-red-700"
            }`}
        >
          {statusMsg.type === "warning" ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Khung thông tin chung & Thanh công cụ Import PDF/Excel + In Tem Label */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-8">
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Ghi chú Phiếu nhập kho
            </label>
            <input
              type="text"
              disabled={isCompleted}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Nhập lô hàng Áo Kamito & Giày Asia đợt 1..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-bold uppercase text-emerald-700 mb-1">
              Nhập vào Kho (Chọn Tầng) *
            </label>
            <select
              disabled={isCompleted}
              value={targetWarehouse}
              onChange={(e) =>
                setTargetWarehouse(e.target.value === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1")
              }
              className="w-full px-3 py-2 rounded-lg border-2 border-emerald-600 text-sm font-bold text-slate-900 bg-emerald-50/40 disabled:bg-slate-100"
            >
              <option value="FLOOR_1">🏢 Kho Tầng 1</option>
              <option value="FLOOR_2">🏬 Kho Tầng 2</option>
            </select>
          </div>
        </div>

        {/* Thanh công cụ Import PDF / Excel & Máy in Label */}
        <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {!isCompleted && (
              <>
                <button
                  type="button"
                  disabled={importingFile}
                  onClick={() => {
                    setFileImportMode("replace");
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>
                    {importingFile
                      ? "Đang đọc file..."
                      : "📄 Import PDF / Excel (.xlsx, .csv, .pdf)"}
                  </span>
                </button>

                {validItemCount > 0 && (
                  <button
                    type="button"
                    disabled={importingFile}
                    onClick={() => {
                      setFileImportMode("append");
                      fileInputRef.current?.click();
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>+ Nối thêm từ file</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5"
                  title="Tải file Excel (.csv) mẫu chuẩn 11Sport"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Tải File Excel Mẫu</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => openPrintModalForCurrentItems(items)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ Xuất Mã Vạch / In Tem Label ({validItemCount} dòng)</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={quickCheckSearch}
              onChange={(e) => setQuickCheckSearch(e.target.value)}
              placeholder="Tìm mã, tên, màu, size trong phiếu..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>

        {/* KHUNG ĐIỀU KHIỂN MÁY QUÉT LABEL — QUÉT KIỂM HÀNG NHẬP KHO */}
        {!isCompleted && (
          <div className="rounded-xl border-2 border-emerald-500/80 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white p-3.5 space-y-2.5 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                  <ScanLine className="w-5 h-5 text-emerald-400" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-emerald-300">
                      Máy Quét Label — Quét Kiểm Hàng Nhập Kho
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        scannerEnabled
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      <Zap className="w-3 h-3" />
                      {scannerEnabled
                        ? "ĐANG BẬT (Bóp cò quét ở bất kỳ đâu)"
                        : "ĐANG TẠM TẮT"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Bắn mã vạch trên sản phẩm để tự động <strong>+1 SL Thực nhận</strong> &amp; <strong>Tick Xác nhận nhập</strong> (Khử lỗi bộ gõ Tiếng Việt Unikey).
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  value={multiRowScanMode}
                  onChange={(e) =>
                    setMultiRowScanMode(e.target.value === "AUTO_NEXT" ? "AUTO_NEXT" : "PICK")
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-xs font-bold focus:outline-none"
                  title="Cách xử lý khi 1 Mã SP có nhiều dòng Màu/Size trong phiếu"
                >
                  <option value="PICK">🎨 Trùng Mã SP: Hỏi chọn Size/Màu (Phím 1..9)</option>
                  <option value="AUTO_NEXT">⚡ Trùng Mã SP: Tự cộng dòng chưa đủ</option>
                </select>

                {lastUndoRowIdx !== null && items[lastUndoRowIdx] && (
                  <button
                    type="button"
                    onClick={() => applyScanDeltaToRow(lastUndoRowIdx, -1)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-extrabold flex items-center gap-1.5 transition"
                    title="Trừ lại 1 chiếc của lần quét gần nhất"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Hoàn tác (-1)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setScannerEnabled((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition ${
                    scannerEnabled
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-400"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600"
                  }`}
                >
                  {scannerEnabled ? "🟢 Đang nhận máy quét" : "⚪ Bật nhận máy quét"}
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!scannerInput.trim()) return;
                handleBarcodeScanForImportCheck(scannerInput.trim());
                setScannerInput("");
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <div className="relative flex-1">
                <ScanLine className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  data-barcode-input="true"
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value)}
                  placeholder="Quét mã vạch sản phẩm vào đây (VD: GASIA221401) hoặc bóp cò máy quét..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/90 border border-slate-600 focus:border-emerald-400 text-white placeholder:text-slate-400 text-xs sm:text-sm font-mono font-bold focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!scannerInput.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-extrabold text-xs whitespace-nowrap transition"
              >
                +1 Kiểm hàng (Enter)
              </button>
            </form>

            {lastScanFeedback && (
              <div
                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 border ${
                  lastScanFeedback.type === "success"
                    ? "bg-emerald-950/90 border-emerald-500/60 text-emerald-200"
                    : lastScanFeedback.type === "warning"
                    ? "bg-amber-950/90 border-amber-400/70 text-amber-200"
                    : "bg-red-950/90 border-red-500/70 text-red-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {lastScanFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
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

        {/* Thanh Thống kê */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ListChecks className="w-4 h-4 text-emerald-600" />
              Đã kiểm:{" "}
              <span className="font-mono text-sm text-emerald-700">
                {checkedRows}/{totalRows}
              </span>{" "}
              dòng
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
              Khớp đủ: {matchedRows}
            </span>
            {shortageRows > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold">
                Thiếu: {shortageRows}
              </span>
            )}
            {surplusRows > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold">
                Thừa: {surplusRows}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold">
              Xác nhận nhập: {confirmedRows}/{totalRows}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white font-bold">
              Tổng giá gốc: {formatVND(totalCostValue)}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-700 text-white font-bold">
              Tổng giá bán: {formatVND(totalSellingValue)}
            </span>
            {missingCostRows > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 font-bold">
                Chưa nhập giá gốc: {missingCostRows} dòng
              </span>
            )}
            {missingSellingRows > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold">
                Chưa nhập giá bán: {missingSellingRows} dòng
              </span>
            )}
          </div>

          {!isCompleted && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setItems((prev) =>
                    prev.map((it) => ({
                      ...it,
                      isChecked: true,
                      isConfirmed: true,
                    }))
                  );
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-1"
              >
                <CheckSquare className="w-3.5 h-3.5" /> Tick xác nhận tất cả
              </button>
            </div>
          )}
        </div>

        {/* BẢNG HÀNG NHẬP KHO (Có đầy đủ Mã SP Chung, Tên hàng, Màu sắc, Size, ĐVT, Số lượng, Giá gốc, Giá bán) */}
        <div
          className={`overflow-x-auto border border-slate-200 rounded-xl transition-all ${activeSuggestRowIdx !== null ? "pb-64" : ""
            }`}
        >
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="py-3 px-2 text-center w-10">STT</th>
                <th className="py-3 px-2.5 min-w-[160px]">
                  MÃ SP
                </th>
                <th className="py-3 px-2.5 min-w-[200px]">TÊN SẢN PHẨM</th>
                <th className="py-3 px-2 min-w-[130px] text-cyan-300">CATEGORY</th>
                <th className="py-3 px-2 min-w-[105px] text-cyan-300">HÃNG (NN)</th>
                <th className="py-3 px-2 min-w-[110px] text-amber-300">MÀU SẮC</th>
                <th className="py-3 px-2 w-24 min-w-[85px] text-center text-amber-300">
                  SIZE
                </th>
                <th className="py-3 px-2 w-20 min-w-[75px] text-center">ĐVT</th>
                <th className="py-3 px-2 w-24 min-w-[88px] text-right">SL DỰ KIẾN</th>
                <th className="py-3 px-2 w-28 min-w-[100px] text-right bg-slate-800 text-amber-300">
                  SL THỰC NHẬN
                </th>
                <th className="py-3 px-2.5 w-32 min-w-[125px] text-right">
                  GIÁ GỐC (VND)
                </th>
                <th className="py-3 px-2.5 w-32 min-w-[125px] text-right text-emerald-300">
                  GIÁ BÁN (VND)
                </th>
                <th className="py-3 px-2 min-w-[130px]">GHI CHÚ</th>
                <th className="py-3 px-2 w-24 text-center bg-slate-800 text-emerald-300">
                  XÁC NHẬN
                </th>
                {!isCompleted && <th className="py-3 px-2 w-16 text-center">THÊM/XÓA</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.map(({ item: row, idx }) => {
                const diff = row.actualQuantity - row.expectedQuantity;
                const existingProd = row.productCode
                  ? catalogByCode.get(row.productCode)
                  : undefined;

                return (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50 transition-colors ${
                      lastScannedRowIdx === idx
                        ? "bg-emerald-100/80 ring-2 ring-inset ring-emerald-500"
                        : row.isConfirmed
                          ? "bg-emerald-50/20"
                          : ""
                    }`}
                  >
                    {/* STT */}
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700 align-top pt-3.5">
                      {idx + 1}
                    </td>

                    {/* MÃ SP CHUNG (Chữ đầu Cate + Hãng/NN + 6 chữ số, VD: GASIA221401) */}
                    <td className="py-2.5 px-2.5 align-top">
                      <input
                        type="text"
                        disabled={isCompleted}
                        value={row.productCode}
                        onChange={(e) => handleUpdateRow(idx, "productCode", e.target.value)}
                        placeholder="VD: GASIA221401"
                        className="w-full bg-blue-50/70 text-blue-900 font-mono text-xs font-extrabold px-2.5 py-1.5 rounded border border-blue-300 uppercase focus:border-blue-600 focus:outline-none disabled:bg-slate-100"
                        title="Mã sản phẩm: Chữ đầu Cate + Tên Hãng (hoặc NN) + 6 chữ số (VD: GASIA221401)"
                      />
                      <div className="mt-1 text-[10px] text-slate-500 space-y-0.5">
                        {(row.color || row.size) && row.productCode && (
                          <div className="font-mono font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded inline-block">
                            Mã con in tem: {generateVariantProductCode(row.productCode, row.color, row.size)}
                          </div>
                        )}
                        <div>
                          {existingProd ? (
                            <span className="text-emerald-700 font-bold">
                              ✓ Đã có mã gốc (Tồn: {existingProd.stock})
                            </span>
                          ) : row.productCode ? (
                            <span>Mã gốc: Cate + Hãng/NN + 6 số</span>
                          ) : (
                            <span>VD: GASIA221401 / GNN221401</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* TÊN HÀNG */}
                    <td className="py-2.5 px-2.5 align-top">
                      <div className="relative">
                        <textarea
                          disabled={isCompleted}
                          rows={Math.max(1, Math.ceil((row.productName?.length || 0) / 36))}
                          value={row.productName}
                          onFocus={() => {
                            if (!isCompleted) {
                              setActiveSuggestRowIdx(idx);
                              setSuggestHighlightIdx(0);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              setActiveSuggestRowIdx((prev) => (prev === idx ? null : prev));
                            }, 180);
                          }}
                          onChange={(e) => {
                            handleUpdateRow(idx, "productName", e.target.value);
                            setActiveSuggestRowIdx(idx);
                            setSuggestHighlightIdx(0);
                          }}
                          onKeyDown={(e) => {
                            if (activeSuggestRowIdx !== idx) return;
                            const suggestions = getRowProductSuggestions(row.productName);
                            if (suggestions.length === 0) return;
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              setSuggestHighlightIdx((prev) => (prev + 1) % suggestions.length);
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setSuggestHighlightIdx(
                                (prev) => (prev - 1 + suggestions.length) % suggestions.length
                              );
                            } else if (e.key === "Enter" && !e.shiftKey) {
                              const picked = suggestions[suggestHighlightIdx] || suggestions[0];
                              if (picked && picked.name !== row.productName) {
                                e.preventDefault();
                                handleSelectSuggestedProduct(idx, picked);
                              }
                            } else if (e.key === "Escape") {
                              setActiveSuggestRowIdx(null);
                            }
                          }}
                          placeholder="Gõ tên hàng (VD: Áo đấu Kamito Pro)..."
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100 whitespace-pre-wrap break-words leading-snug resize-y font-medium text-slate-900"
                        />

                        {!isCompleted &&
                          activeSuggestRowIdx === idx &&
                          (() => {
                            const suggestions = getRowProductSuggestions(row.productName);
                            if (suggestions.length === 0) return null;
                            return (
                              <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-xl border-2 border-emerald-500 shadow-2xl overflow-hidden min-w-[320px] sm:min-w-[400px]">
                                <div className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold flex items-center justify-between gap-2">
                                  <span>📦 Gợi ý sản phẩm trong kho ({suggestions.length})</span>
                                  <span className="text-emerald-300 font-normal">
                                    Bấm chọn để lấy Mã chung & Giá
                                  </span>
                                </div>
                                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                                  {suggestions.map((p, sIdx) => {
                                    const isHighlighted = sIdx === suggestHighlightIdx;
                                    return (
                                      <button
                                        key={p._id}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleSelectSuggestedProduct(idx, p);
                                        }}
                                        onMouseEnter={() => setSuggestHighlightIdx(sIdx)}
                                        className={`w-full text-left px-3 py-2 transition flex flex-col gap-0.5 ${isHighlighted ? "bg-emerald-50/90" : "hover:bg-slate-50"
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

                    {/* CATEGORY (CHỌN DANH MỤC ĐỂ LẤY CHỮ CÁI ĐẦU MÃ SP) */}
                    <td className="py-2.5 px-2 align-top">
                      <select
                        disabled={isCompleted}
                        value={String(row.categoryId || defaultCategoryId || categories[0]?._id || "")}
                        onChange={(e) => {
                          setDefaultCategoryId(e.target.value);
                          handleUpdateRow(idx, "categoryId", e.target.value);
                        }}
                        className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100"
                        title="Chọn Category của dòng sản phẩm (Chữ cái đầu của Category sẽ đứng đầu Mã SP)"
                      >
                        {categories.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* HÃNG (BRAND — ĐỂ TRỐNG HOẶC NN LÀ NO NAME) */}
                    <td className="py-2.5 px-2 align-top">
                      <input
                        type="text"
                        disabled={isCompleted}
                        value={row.brand || ""}
                        onChange={(e) => handleUpdateRow(idx, "brand", e.target.value)}
                        placeholder="NN (Không hãng)"
                        className="w-full px-2 py-1.5 rounded border border-slate-300 font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100"
                        title="Tên hãng sản xuất (Để trống hoặc gõ NN nếu không có hãng)"
                      />
                    </td>

                    {/* MÀU SẮC */}
                    <td className="py-2.5 px-2 align-top">
                      <input
                        type="text"
                        list="import-color-suggestions"
                        disabled={isCompleted}
                        value={row.color || ""}
                        onChange={(e) => handleUpdateRow(idx, "color", e.target.value)}
                        placeholder="VD: Đỏ, Trắng..."
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100"
                      />
                    </td>

                    {/* SIZE */}
                    <td className="py-2.5 px-2 align-top">
                      <input
                        type="text"
                        list="import-size-suggestions"
                        disabled={isCompleted}
                        value={row.size || ""}
                        onChange={(e) => handleUpdateRow(idx, "size", e.target.value.toUpperCase())}
                        placeholder="S, M, L, 42..."
                        className="w-full px-2 py-1.5 rounded border border-slate-300 text-center font-mono font-extrabold uppercase text-indigo-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100"
                      />
                    </td>

                    {/* ĐVT */}
                    <td className="py-2.5 px-2 align-top">
                      <input
                        type="text"
                        disabled={isCompleted}
                        value={row.unit}
                        onChange={(e) => handleUpdateRow(idx, "unit", e.target.value)}
                        placeholder="ĐVT"
                        className="w-full px-2 py-1.5 rounded border border-slate-300 text-center font-medium text-slate-900 disabled:bg-slate-100"
                      />
                    </td>

                    {/* SL DỰ KIẾN */}
                    <td className="py-2.5 px-2 align-top">
                      <input
                        type="number"
                        min={0}
                        disabled={isCompleted}
                        value={row.expectedQuantity}
                        onChange={(e) =>
                          handleUpdateRow(
                            idx,
                            "expectedQuantity",
                            Math.max(0, Number(e.target.value))
                          )
                        }
                        className="w-full px-2 py-1.5 rounded border border-slate-300 text-right font-mono font-bold text-slate-900 disabled:bg-slate-100"
                      />
                    </td>

                    {/* SL THỰC NHẬN */}
                    <td className="py-2.5 px-2 bg-amber-50/40 align-top">
                      <input
                        type="number"
                        min={0}
                        disabled={isCompleted}
                        value={row.actualQuantity}
                        onChange={(e) =>
                          handleUpdateRow(
                            idx,
                            "actualQuantity",
                            Math.max(0, Number(e.target.value))
                          )
                        }
                        className="w-full px-2 py-1.5 rounded border border-amber-400 text-right font-mono font-bold bg-white disabled:bg-slate-100"
                      />
                      <div className="mt-1 text-[10px] text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${diff === 0
                            ? "bg-emerald-100 text-emerald-800"
                            : diff > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-700"
                            }`}
                        >
                          {diff === 0 ? "Khớp đủ" : diff > 0 ? `+${diff} Thừa` : `${diff} Thiếu`}
                        </span>
                      </div>
                    </td>

                    {/* GIÁ GỐC */}
                    <td className="py-2.5 px-2.5 align-top">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={isCompleted}
                          value={
                            Number(row.costPrice) > 0 ? formatNumberDots(row.costPrice) : ""
                          }
                          onChange={(e) =>
                            handleUpdateRow(idx, "costPrice", parseNumberDots(e.target.value))
                          }
                          placeholder="0"
                          className={`w-full pl-2 pr-8 py-1.5 rounded border text-right font-mono font-bold disabled:bg-slate-100 ${Number(row.costPrice) > 0 || !row.productName.trim()
                            ? "border-slate-300"
                            : "border-orange-300 bg-orange-50"
                            }`}
                        />
                        <span className="absolute right-1.5 top-2 text-[9px] font-mono font-bold text-slate-400 pointer-events-none">
                          đ
                        </span>
                      </div>
                    </td>

                    {/* GIÁ BÁN */}
                    <td className="py-2.5 px-2.5 align-top bg-emerald-50/20">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={isCompleted}
                          value={
                            Number(row.sellingPrice) > 0
                              ? formatNumberDots(row.sellingPrice)
                              : ""
                          }
                          onChange={(e) =>
                            handleUpdateRow(idx, "sellingPrice", parseNumberDots(e.target.value))
                          }
                          placeholder="0"
                          className={`w-full pl-2 pr-8 py-1.5 rounded border text-right font-mono font-bold text-emerald-900 disabled:bg-slate-100 ${Number(row.sellingPrice) > 0 || !row.productName.trim()
                            ? "border-emerald-300 bg-white"
                            : "border-amber-300 bg-amber-50/60"
                            }`}
                        />
                        <span className="absolute right-1.5 top-2 text-[9px] font-mono font-bold text-slate-400 pointer-events-none">
                          đ
                        </span>
                      </div>
                    </td>

                    {/* GHI CHÚ */}
                    <td className="py-2.5 px-2 align-top">
                      <input
                        type="text"
                        disabled={isCompleted}
                        value={row.note}
                        onChange={(e) => handleUpdateRow(idx, "note", e.target.value)}
                        placeholder="Ghi chú..."
                        className="w-full px-2 py-1.5 rounded border border-slate-300 disabled:bg-slate-100"
                      />
                    </td>

                    {/* XÁC NHẬN */}
                    <td className="py-2.5 px-2 text-center bg-emerald-50/30 align-top pt-3">
                      <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isCompleted}
                          checked={row.isConfirmed}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            handleUpdateRow(idx, "isConfirmed", checked);
                            if (checked) handleUpdateRow(idx, "isChecked", true);
                          }}
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        <span
                          className={`text-[10px] font-bold ${row.isConfirmed ? "text-emerald-800" : "text-slate-400"
                            }`}
                        >
                          {row.isConfirmed ? "✓ Nhập" : "Bỏ qua"}
                        </span>
                      </label>
                    </td>

                    {/* THÊM SIZE/MÀU CÙNG MÃ / XÓA DÒNG */}
                    {!isCompleted && (
                      <td className="py-2.5 px-1.5 text-center align-top pt-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicateRowForVariant(idx)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Thêm nhanh 1 Size / Màu khác cho cùng Mã sản phẩm này"
                          >
                            <CopyPlus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            title="Xóa dòng"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!isCompleted && (
            <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm dòng mới</span>
              </button>
              <span className="text-[11px] text-slate-500">
                Bấm <strong>Thêm dòng mới</strong> để thêm mặt hàng hoặc bấm biểu tượng nhân bản ở cuối dòng để thêm Size / Màu cùng Mã SP
              </span>
            </div>
          )}
        </div>

        {/* Thanh hành động cuối phiếu */}
        {isCompleted ? (
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700">
            <div className="flex items-start sm:items-center gap-2 font-bold">
              <Lock className="w-4 h-4 text-slate-600 shrink-0" />
              Phiếu nhập này đã HOÀN THÀNH và bị khóa vĩnh viễn (BR-10). Bạn vẫn có thể bấm In Tem Mã Vạch bất kỳ lúc nào.
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openPrintModalForCurrentItems(items)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" /> In Tem Mã Vạch Lô Này
              </button>
              {currentReceipt && (
                <button
                  type="button"
                  onClick={() => setDetailModalReceipt(currentReceipt)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Eye className="w-4 h-4" /> Xem chi tiết phiếu
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loading || !hasReceiptChanges || validItemCount === 0}
                onClick={handleSaveDraft}
                className={`px-5 py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition ${hasReceiptChanges && validItemCount > 0 && !loading
                  ? "border-2 border-blue-600 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  : "border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
              >
                <Save className="w-4 h-4" />
                {hasReceiptChanges && validItemCount > 0
                  ? "💾 Lưu nháp phiếu nhập"
                  : "💾 Đã lưu nháp"}
              </button>
              {currentReceipt?._id && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDeleteReceipt(currentReceipt)}
                  className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa phiếu
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
              <button
                type="button"
                onClick={() => openPrintModalForCurrentItems(items)}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow"
              >
                <Printer className="w-4 h-4" />
                🖨️ In Tem Mã Vạch (Label)
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleCompleteImport}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4" />
                ✅ Hoàn thành Nhập Kho ({confirmedRows} dòng đã tick)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MỤC XEM LẠI CHI TIẾT KHI NHẬP HÀNG VÀO KHO */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                Xem Lại Chi Tiết Khi Nhập Hàng Vào Kho ({receipts.length} phiếu)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Lưu đầy đủ Mã sản phẩm chung, Màu sắc, Size, Số lượng thực nhận, Giá nhập / Giá bán và hỗ trợ in lại tem mã vạch bất kỳ lúc nào.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="COMPLETED">Đã hoàn thành</option>
              <option value="DRAFT">Phiếu nháp</option>
            </select>

            <select
              value={historyRoleFilter}
              onChange={(e) => setHistoryRoleFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="ALL">Tất cả người nhập (Admin + Warehouse)</option>
              <option value="ADMIN">Người nhập: ADMIN (Quản lý)</option>
              <option value="WAREHOUSE">Người nhập: WAREHOUSE (Thủ kho)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="py-2.5 px-3">Mã phiếu</th>
                <th className="py-2.5 px-3">Kho nhận</th>
                <th className="py-2.5 px-3">Người nhập (Vai trò)</th>
                <th className="py-2.5 px-3">Người hoàn thành</th>
                <th className="py-2.5 px-3">Trạng thái</th>
                <th className="py-2.5 px-3 text-right">Số dòng / Tổng SL</th>
                <th className="py-2.5 px-3 text-right">Tổng trị giá nhập</th>
                <th className="py-2.5 px-3">Thời gian</th>
                <th className="py-2.5 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {receipts
                .filter((rc) => {
                  if (historyStatusFilter !== "ALL" && rc.status !== historyStatusFilter) {
                    return false;
                  }
                  if (historyRoleFilter !== "ALL") {
                    const creatorRole = normalizeActorRole(
                      rc.createdByRole,
                      rc.createdByName,
                      rc.createdBy
                    );
                    const completerRole = rc.completedByName
                      ? normalizeActorRole(
                        rc.completedByRole,
                        rc.completedByName,
                        rc.completedBy
                      )
                      : creatorRole;
                    if (creatorRole !== historyRoleFilter && completerRole !== historyRoleFilter) {
                      return false;
                    }
                  }
                  return true;
                })
                .map((rc) => {
                  const code = rc.code || rc.receiptCode || rc._id.slice(-6);
                  const isExpanded = expandedHistoryId === rc._id;
                  const rcItems = rc.items || [];
                  const totalExp = rcItems.reduce(
                    (s, i) => s + Number(i.expectedQuantity || 0),
                    0
                  );
                  const totalAct = rcItems.reduce(
                    (s, i) => s + Number(i.actualQuantity || 0),
                    0
                  );
                  const totalCost = rcItems.reduce(
                    (s, i) => s + Number(i.costPrice || 0) * Number(i.actualQuantity || 0),
                    0
                  );
                  return (
                    <React.Fragment key={rc._id}>
                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-extrabold text-slate-900">
                          {code}
                          {rc.note && (
                            <div className="font-sans font-normal text-[11px] text-slate-500 truncate max-w-[180px]">
                              {rc.note}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${rc.targetWarehouse === "FLOOR_2"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-indigo-100 text-indigo-800"
                              }`}
                          >
                            {rc.targetWarehouse === "FLOOR_2"
                              ? "🏬 Kho Tầng 2"
                              : "🏢 Kho Tầng 1"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">
                            {rc.createdByName || "Thủ kho"}
                          </div>
                          <div className="mt-0.5">
                            <RoleBadge
                              role={rc.createdByRole}
                              name={rc.createdByName}
                              userId={rc.createdBy}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {rc.status === "COMPLETED" ? (
                            <div>
                              <div className="font-bold text-emerald-900">
                                {rc.completedByName || rc.createdByName || "Thủ kho"}
                              </div>
                              <div className="mt-0.5">
                                <RoleBadge
                                  role={rc.completedByRole || rc.createdByRole}
                                  name={rc.completedByName || rc.createdByName}
                                  userId={rc.completedBy || rc.createdBy}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Chưa hoàn thành</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rc.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                              }`}
                          >
                            {rc.status === "COMPLETED" ? "HOÀN THÀNH" : "NHÁP"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className="font-bold text-slate-900">{rcItems.length} dòng</span> •{" "}
                          <span className="font-extrabold text-emerald-700">
                            {totalAct}/{totalExp}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatVND(totalCost)}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-600">
                          <div>Tạo: {formatDateTime(rc.createdAt)}</div>
                          {rc.completedAt && (
                            <div className="text-emerald-700 font-semibold">
                              Xong: {formatDateTime(rc.completedAt)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openPrintModalForCurrentItems(rcItems)}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[11px] flex items-center gap-1"
                              title="In tem mã vạch cho phiếu nhập này"
                            >
                              <Printer className="w-3.5 h-3.5" /> In tem
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedHistoryId(isExpanded ? null : rc._id)
                              }
                              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px]"
                            >
                              {isExpanded ? "Thu gọn" : "Xem nhanh"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailModalReceipt(rc)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> Chi tiết
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={9} className="p-3">
                            <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="font-extrabold text-slate-800">
                                  Chi tiết các mặt hàng trong phiếu {code} ({rcItems.length} dòng)
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSelectReceipt(rc)}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                                >
                                  Mở lên bảng chính
                                </button>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-[11px] text-left border border-slate-200">
                                  <thead className="bg-slate-100 text-slate-700 uppercase">
                                    <tr>
                                      <th className="py-1.5 px-2">STT</th>
                                      <th className="py-1.5 px-2">Mã SP Chung</th>
                                      <th className="py-1.5 px-2">Tên sản phẩm</th>
                                      <th className="py-1.5 px-2">Màu sắc</th>
                                      <th className="py-1.5 px-2 text-center">Size</th>
                                      <th className="py-1.5 px-2 text-center">ĐVT</th>
                                      <th className="py-1.5 px-2 text-right">SL Thực nhận</th>
                                      <th className="py-1.5 px-2 text-right">Giá gốc</th>
                                      <th className="py-1.5 px-2 text-right">Giá bán</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {rcItems.map((it, i) => (
                                      <tr key={i}>
                                        <td className="py-1.5 px-2 font-mono">{i + 1}</td>
                                        <td className="py-1.5 px-2 font-mono font-bold text-blue-700">
                                          <div>
                                            {it.variantCode ||
                                              generateVariantProductCode(
                                                it.productCode,
                                                it.color,
                                                it.size
                                              )}
                                          </div>
                                          {(it.color || it.size) && (
                                            <div className="text-[10px] text-slate-400 font-normal">
                                              Gốc: {it.productCode}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-1.5 px-2 font-semibold text-slate-900">
                                          {it.productName}
                                        </td>
                                        <td className="py-1.5 px-2 font-medium text-slate-700">
                                          {it.color || "-"}
                                        </td>
                                        <td className="py-1.5 px-2 text-center font-mono font-bold text-indigo-700">
                                          {it.size || "-"}
                                        </td>
                                        <td className="py-1.5 px-2 text-center">{it.unit}</td>
                                        <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-700">
                                          {it.actualQuantity}
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-mono">
                                          {formatVND(it.costPrice || 0)}
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-mono text-emerald-700 font-semibold">
                                          {formatVND(it.sellingPrice || 0)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
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

      {/* MODAL XEM LẠI CHI TIẾT PHIẾU NHẬP KHO */}
      {detailModalReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Chi tiết Phiếu Nhập Hàng Vào Kho
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <h3 className="text-base sm:text-lg font-extrabold font-mono">
                    {detailModalReceipt.code ||
                      detailModalReceipt.receiptCode ||
                      detailModalReceipt._id}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${detailModalReceipt.status === "COMPLETED"
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-blue-500 text-white"
                      }`}
                  >
                    {detailModalReceipt.status === "COMPLETED" ? "ĐÃ HOÀN THÀNH" : "NHÁP"}
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-slate-800 text-emerald-300 text-xs font-bold">
                    {detailModalReceipt.targetWarehouse === "FLOOR_2"
                      ? "🏬 Kho Tầng 2"
                      : "🏢 Kho Tầng 1"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalReceipt(null)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-white uppercase">
                    <tr>
                      <th className="py-2.5 px-2.5 text-center">STT</th>
                      <th className="py-2.5 px-3">Mã SP Chung</th>
                      <th className="py-2.5 px-3">Tên sản phẩm</th>
                      <th className="py-2.5 px-2.5">Màu sắc</th>
                      <th className="py-2.5 px-2.5 text-center">Size</th>
                      <th className="py-2.5 px-2 text-center">ĐVT</th>
                      <th className="py-2.5 px-2.5 text-right">SL Thực nhận</th>
                      <th className="py-2.5 px-2.5 text-right">Giá gốc</th>
                      <th className="py-2.5 px-2.5 text-right">Giá bán</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(detailModalReceipt.items || []).map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-2.5 text-center font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                          <div>
                            {it.variantCode ||
                              generateVariantProductCode(it.productCode, it.color, it.size)}
                          </div>
                          {(it.color || it.size) && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              Mã gốc: {it.productCode}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {it.productName}
                        </td>
                        <td className="py-2.5 px-2.5 font-medium text-slate-800">
                          {it.color || "-"}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-mono font-bold text-indigo-700">
                          {it.size || "-"}
                        </td>
                        <td className="py-2.5 px-2 text-center">{it.unit}</td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-extrabold text-emerald-700">
                          {it.actualQuantity}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono">
                          {formatVND(it.costPrice || 0)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-emerald-700">
                          {formatVND(it.sellingPrice || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectReceipt(detailModalReceipt);
                    setDetailModalReceipt(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                >
                  Mở phiếu này trên bảng làm việc
                </button>
                <button
                  type="button"
                  onClick={() => openPrintModalForCurrentItems(detailModalReceipt.items || [])}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> In Tem Mã Vạch Phiếu Này
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalReceipt(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chọn Dòng Màu / Size Khi Quét Mã Sản Phẩm Có Nhiều Dòng Trong Phiếu Nhập */}
      {scanCandidateRowIndices && scanCandidateRowIndices.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          onClick={() => setScanCandidateRowIndices(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-emerald-700 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
                  <ScanBarcode className="w-3.5 h-3.5" />
                  Máy Quét Kiểm Hàng • Phím tắt [1..9] để cộng nhanh
                </div>
                <h4 className="font-extrabold text-sm">
                  Mã [{items[scanCandidateRowIndices[0]]?.productCode}] có {scanCandidateRowIndices.length} dòng phân loại — Chọn dòng vừa quét
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setScanCandidateRowIndices(null)}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-[65vh] overflow-y-auto space-y-2">
              {scanCandidateRowIndices.map((rowIdx, idx) => {
                const row = items[rowIdx];
                if (!row) return null;
                const isEnough =
                  row.expectedQuantity > 0 && row.actualQuantity >= row.expectedQuantity;
                return (
                  <button
                    key={rowIdx}
                    type="button"
                    onClick={() => {
                      applyScanDeltaToRow(rowIdx, 1, "máy quét (chọn phân loại)");
                      setScanCandidateRowIndices(null);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                      isEnough
                        ? "border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/70"
                        : "border-amber-300 bg-amber-50/40 hover:bg-amber-100/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {idx < 9 && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-extrabold font-mono">
                          {idx + 1}
                        </span>
                      )}
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">
                          Dòng #{rowIdx + 1}: {row.productName || row.productCode}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {row.color ? (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                              Màu: {row.color}
                            </span>
                          ) : null}
                          {row.size ? (
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold">
                              Size: {row.size}
                            </span>
                          ) : null}
                          {!row.color && !row.size && (
                            <span className="text-[11px] text-slate-500">Mặc định</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-xs font-extrabold ${
                          isEnough ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        Đã kiểm: {row.actualQuantity} / {row.expectedQuantity} {row.unit}
                      </div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold">
                        +1 Thực nhận
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Mẹo: Chuyển sang chế độ <b>&quot;Tự động cộng dòng chưa đủ SL&quot;</b> nếu muốn quét liên tục không cần chọn.
              </span>
              <button
                type="button"
                onClick={() => setScanCandidateRowIndices(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Đóng (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal In Tem Nhãn Mã Vạch (Máy In Label) */}
      <BarcodeLabelModal
        open={Boolean(labelModalItems)}
        onClose={() => setLabelModalItems(null)}
        items={labelModalItems || []}
        title="In Tem Nhãn Mã Vạch Từ Phiếu Nhập Kho"
      />
    </div>
  );
}
