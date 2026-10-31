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
  formatDateTime,
  formatVND,
  formatNumberDots,
  parseNumberDots,
  getStoredUser,
  useDebounce,
  filterAndRankBySearch,
} from "@/lib/api";
import CameraScannerModal, { mergeOcrItemsList } from "./CameraScannerModal";
import TagCheckScannerModal from "./TagCheckScannerModal";
import {
  Camera,
  Plus,
  Trash2,
  Save,
  ArrowRight,
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
} from "lucide-react";

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

  // State form chỉnh sửa phiếu
  const [note, setNote] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [targetWarehouse, setTargetWarehouse] = useState<WarehouseFloor>("FLOOR_1");
  const [items, setItems] = useState<ImportItem[]>([
    {
      stt: 1,
      productName: "",
      productCode: "",
      unit: "Cái",
      expectedQuantity: 1,
      actualQuantity: 1,
      costPrice: 0,
      sellingPrice: 0,
      note: "",
      isChecked: false,
      isConfirmed: false,
      discrepancyNote: "",
    },
  ]);

  // Bước 4: Tìm kiếm nhanh & Quét tag
  const [quickCheckSearch, setQuickCheckSearch] = useState("");
  const [openOcrModal, setOpenOcrModal] = useState(false);
  const [openTagModal, setOpenTagModal] = useState(false);

  // Modal & mục xem lại chi tiết khi nhập hàng vào kho
  const [detailModalReceipt, setDetailModalReceipt] = useState<ImportReceipt | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"ALL" | "COMPLETED" | "CHECKING" | "DRAFT">("ALL");
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
        setDefaultCategoryId(catList[0]._id);
      }
    } catch {
      // ignore
    }
  }, [defaultCategoryId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setReceiptDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectReceipt = (rc: ImportReceipt) => {
    setCurrentReceipt(rc);
    setNote(rc.note || "");
    setDefaultCategoryId(rc.defaultCategoryId || categories[0]?._id || "");
    setTargetWarehouse(rc.targetWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1");
    setItems(
      (rc.items || []).map((it, idx) => ({
        stt: idx + 1,
        productCode: it.productCode || generateProductCode(it.productName),
        productName: it.productName,
        categoryId: it.categoryId,
        unit: it.unit || "Cái",
        expectedQuantity: Number(it.expectedQuantity || 0),
        actualQuantity: Number(it.actualQuantity ?? it.expectedQuantity ?? 0),
        costPrice: Number(it.costPrice || 0),
        sellingPrice: Number(it.sellingPrice || 0),
        scannedQuantity: Number(it.scannedQuantity || 0),
        checkedBy: it.checkedBy,
        checkedByName: it.checkedByName,
        checkedByRole: it.checkedByRole,
        checkedAt: it.checkedAt,
        scanCounts: it.scanCounts,
        barcode: it.barcode,
        note: it.note || "",
        isChecked: Boolean(it.isChecked),
        isConfirmed: Boolean(it.isConfirmed),
        discrepancyNote: it.discrepancyNote || "",
      }))
    );
    setStatusMsg(null);
    setReceiptDropdownOpen(false);
  };

  const handleStartNewReceipt = () => {
    setCurrentReceipt(null);
    setNote("");
    setTargetWarehouse("FLOOR_1");
    setItems([
      {
        stt: 1,
        productName: "",
        productCode: "",
        unit: "Cái",
        expectedQuantity: 1,
        actualQuantity: 1,
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

  // Cập nhật từng ô trong bảng 6 cột (Tự sinh MÃ HÀNG từ () trong TÊN HÀNG + đồng bộ số lượng khi chỉnh)
  const handleUpdateRow = (index: number, field: keyof ImportItem, value: any) => {
    if (isCompleted) return;
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === "productName") {
        item.productCode = generateProductCode(String(value));
      }
      if (field === "expectedQuantity") {
        const exp = Math.max(0, Math.round(Number(value) || 0));
        item.expectedQuantity = exp;
        if (currentStepStatus === "DRAFT" || !item.isChecked) {
          item.actualQuantity = exp;
        } else {
          const diff = Number(item.actualQuantity || 0) - exp;
          item.discrepancyNote =
            diff === 0
              ? "Khớp đủ"
              : diff > 0
              ? `Thừa ${diff} ${item.unit || "Cái"}`
              : `Thiếu ${Math.abs(diff)} ${item.unit || "Cái"}`;
        }
      }
      if (field === "actualQuantity") {
        const actual = Math.max(0, Math.round(Number(value) || 0));
        const exp = Math.max(0, Math.round(Number(item.expectedQuantity) || 0));
        item.actualQuantity = actual;
        item.isChecked = true;
        if (actual >= Math.max(1, exp)) {
          item.isConfirmed = true;
        }
        const diff = actual - exp;
        item.discrepancyNote =
          diff === 0
            ? "Khớp đủ"
            : diff > 0
            ? `Thừa ${diff} ${item.unit || "Cái"}`
            : `Thiếu ${Math.abs(diff)} ${item.unit || "Cái"}`;
      }
      next[index] = item;
      return next;
    });
  };

  // Map tra cứu nhanh sản phẩm có sẵn trong kho theo mã code
  const catalogByCode = useMemo(() => {
    const map = new Map<string, Product>();
    catalogProducts.forEach((p) => {
      if (p.code) map.set(p.code, p);
    });
    return map;
  }, [catalogProducts]);

  // Lấy danh sách gợi ý sản phẩm có trong kho khi gõ tên hàng
  const getRowProductSuggestions = useCallback(
    (query: string): Product[] => {
      const q = (query || "").trim();
      if (!q) {
        return catalogProducts.slice(0, 8);
      }
      const matched = filterAndRankBySearch(catalogProducts, q, (p) => [
        p.name,
        p.code,
        p.categoryName,
      ]);
      // Nếu tên đang gõ đã khớp y hệt 1 sản phẩm duy nhất và không còn gợi ý khác thì vẫn hiển thị để dễ đối chiếu hoặc chọn lại
      return matched.slice(0, 8);
    },
    [catalogProducts]
  );

  // Chọn 1 sản phẩm gợi ý từ kho để điền tự động vào dòng phiếu nhập
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

  // Kiểm tra có thay đổi thực sự so với dữ liệu gốc hay không để kích hoạt nút Lưu
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
      if ((cur.unit || "Cái").trim() !== (orig.unit || "Cái").trim()) return true;
      if (Number(cur.expectedQuantity || 0) !== Number(orig.expectedQuantity || 0)) return true;
      if (Number(cur.actualQuantity || 0) !== Number(orig.actualQuantity ?? orig.expectedQuantity ?? 0)) return true;
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
    setItems((prev) => [
      ...prev,
      {
        stt: prev.length + 1,
        productName: "",
        productCode: "",
        unit: "Cái",
        expectedQuantity: 10,
        actualQuantity: 10,
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

  // Bước 6: Lưu nháp ở bất kỳ bước nào trước khi hoàn thành
  const handleSaveDraft = async (): Promise<ImportReceipt | null> => {
    setStatusMsg(null);
    const validItems = items
      .filter((i) => i.productName.trim() !== "")
      .map((it, idx) => ({
        ...it,
        stt: idx + 1,
        productCode: it.productCode || generateProductCode(it.productName),
        categoryId: it.categoryId || defaultCategoryId || undefined,
      }));

    if (validItems.length === 0) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng nhập ít nhất 1 dòng hàng hợp lệ trong bảng 6 cột.",
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

  // Bước 3: Nút "Hoàn tất" danh sách dự kiến -> Chuyển sang CHECKING
  const handleFinishListing = async () => {
    const saved = await handleSaveDraft();
    if (!saved?._id) return;

    setLoading(true);
    try {
      const res = await apiRequest<ImportReceipt>(
        `/imports/${saved._id}/finish-listing`,
        {
          method: "POST",
        }
      );
      handleSelectReceipt(res.data);
      await loadInitialData();
      setStatusMsg({
        type: "success",
        text: "Đã chốt danh sách kiểm hàng (Bước 3). Đang mở camera quét Tag kiểm tra thực tế (Bước 4)...",
      });
      setOpenTagModal(true);
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể chuyển sang bước Kiểm thực tế.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Bước 4: Mở màn hình quét Tag liên tục (chỉ đối chiếu với danh sách đã OCR ở bước Kiểm hàng).
  // Lưu các chỉnh sửa hiện tại trước để server đối chiếu đúng danh sách.
  const handleOpenTagScanner = async () => {
    const saved = await handleSaveDraft();
    if (!saved?._id) return;
    if (saved.status !== "CHECKING") {
      setStatusMsg({
        type: "warning",
        text: 'Vui lòng bấm "Hoàn tất kiểm hàng" trước khi quét Tag kiểm tra thực tế.',
      });
      return;
    }
    setOpenTagModal(true);
  };

  // Bước 7: Hoàn thành nhập kho (Chỉ đẩy các dòng isConfirmed = true vào kho và khóa phiếu)
  const handleCompleteImport = async () => {
    const confirmedCount = items.filter((i) => i.isConfirmed).length;
    if (confirmedCount === 0) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng tick xác nhận (Bước 5) ít nhất 1 dòng hàng đã kiểm trước khi bấm Hoàn thành!",
      });
      return;
    }

    const saved = await handleSaveDraft();
    if (!saved?._id) return;

    setLoading(true);
    try {
      const res = await apiRequest<any>(
        `/imports/${saved._id}/complete`,
        {
          method: "POST",
          body: JSON.stringify({
            defaultCategoryId: defaultCategoryId || undefined,
            targetWarehouse,
            items: saved.items,
          }),
        }
      );
      const completedReceipt: ImportReceipt = res.data?.receipt || res.data;
      handleSelectReceipt(completedReceipt);
      await loadInitialData();
      setStatusMsg({
        type: "success",
        text: `HOÀN THÀNH NHẬP KHO (${targetWarehouse === "FLOOR_2" ? "Kho Tầng 2" : "Kho Tầng 1"})! Đã đẩy ${confirmedCount} dòng xác nhận vào tồn kho, ghi Sổ kho (StockMovement) và khóa phiếu.`,
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
    if (
      !window.confirm(`Bạn có chắc chắn muốn XÓA phiếu nhập "${code}" không?`)
    ) {
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

  // Thống kê Bước 5 (Tổng kết)
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
  // Tổng giá trị nhập theo giá gốc và giá bán (SL thực nhận × đơn giá)
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

  // Debounce tìm kiếm nhanh trong bảng kiểm hàng và tìm phiếu nhập kho (300ms)
  const debouncedQuickCheckSearch = useDebounce(quickCheckSearch, 300);
  const debouncedReceiptSearch = useDebounce(receiptSearch, 300);

  const filteredItems = useMemo(() => {
    const indexed = items.map((item, idx) => ({ item, idx }));
    if (!debouncedQuickCheckSearch.trim()) return indexed;
    return filterAndRankBySearch(indexed, debouncedQuickCheckSearch, ({ item }) => [
      { text: item.productCode, weight: 1.5 },
      { text: item.barcode, weight: 1.5 },
      { text: item.productName, weight: 1.3 },
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
      ]),
    ]);
  }, [receipts, debouncedReceiptSearch]);

  const currentReceiptCode = currentReceipt
    ? currentReceipt.code || currentReceipt.receiptCode || currentReceipt._id.slice(-6)
    : "";

  return (
    <div className="space-y-4">
      {/* Thanh Chọn Phiếu Nhập Kho (Dropdown) & Tiến trình 7 bước */}
      <div className="bg-slate-900 text-white rounded-xl p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase text-emerald-400">
              Quy trình Nhập Kho 7 Bước Chuẩn 11Sport
            </span>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <h2 className="text-base sm:text-lg font-extrabold">
                {currentReceipt
                  ? `Phiếu nhập: ${currentReceiptCode}`
                  : "Soạn Phiếu Nhập Kho Mới"}
              </h2>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-extrabold ${
                  currentStepStatus === "COMPLETED"
                    ? "bg-emerald-500 text-slate-950"
                    : currentStepStatus === "CHECKING"
                    ? "bg-amber-400 text-slate-950"
                    : "bg-blue-500 text-white"
                }`}
              >
                Trạng thái:{" "}
                {currentStepStatus === "COMPLETED"
                  ? "ĐÃ HOÀN THÀNH (ĐÃ KHÓA)"
                  : currentStepStatus === "CHECKING"
                  ? "ĐANG KIỂM THỰC TẾ (CHECKING)"
                  : "SOẠN DỰ KIẾN (DRAFT)"}
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
                    currentReceipt
                      ? currentReceipt.createdByRole
                      : currentUser?.role || "WAREHOUSE"
                  }
                  name={
                    currentReceipt
                      ? currentReceipt.createdByName
                      : currentUser?.fullName
                  }
                  userId={currentReceipt?.createdBy}
                />
              </span>
              {currentReceipt?.status === "COMPLETED" && (
                <span className="inline-flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-700 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Hoàn thành bởi:</span>
                  <strong className="text-emerald-200">
                    {currentReceipt.completedByName ||
                      currentReceipt.createdByName ||
                      "Thủ kho"}
                  </strong>
                  <RoleBadge
                    role={
                      currentReceipt.completedByRole ||
                      currentReceipt.createdByRole
                    }
                    name={
                      currentReceipt.completedByName ||
                      currentReceipt.createdByName
                    }
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
                        <span className="font-mono text-emerald-400">
                          {currentReceiptCode}
                        </span>
                        <span>•</span>
                        <span className="text-slate-200 truncate max-w-[180px] sm:max-w-[240px]">
                          {currentReceipt.note || "Phiếu nhập kho"}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-200">
                          {currentReceipt.items?.length || 0} SP
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
                  className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${
                    receiptDropdownOpen ? "rotate-180 text-emerald-400" : ""
                  }`}
                />
              </button>

              {/* Menu Dropdown danh sách phiếu nhập */}
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
                        const code =
                          rc.code || rc.receiptCode || rc._id.slice(-6);
                        const isSelected = currentReceipt?._id === rc._id;
                        return (
                          <div
                            key={rc._id}
                            onClick={() => handleSelectReceipt(rc)}
                            className={`p-3 cursor-pointer transition hover:bg-slate-50 ${
                              isSelected
                                ? "bg-emerald-50/80 border-l-4 border-l-emerald-600"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono font-extrabold text-xs text-slate-900">
                                  {code}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    rc.status === "COMPLETED"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : rc.status === "CHECKING"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {rc.status === "COMPLETED"
                                    ? "HOÀN THÀNH"
                                    : rc.status === "CHECKING"
                                    ? "ĐANG KIỂM"
                                    : "NHÁP (DRAFT)"}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    rc.targetWarehouse === "FLOOR_2"
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
                                  {rc.items?.length || 0} mặt hàng
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailModalReceipt(rc);
                                    setReceiptDropdownOpen(false);
                                  }}
                                  className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center gap-1"
                                  title="Xem lại chi tiết phiếu nhập"
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
                                  <span className="text-emerald-700 font-bold">
                                    Đang mở
                                  </span>
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <div
            className={`p-2.5 rounded-lg border ${
              currentStepStatus === "DRAFT"
                ? "border-emerald-400 bg-slate-800"
                : "border-slate-700 bg-slate-800/50"
            }`}
          >
            <div className="font-bold text-emerald-400">Bước 1 & 2</div>
            <div className="text-slate-300 text-[11px]">
              Bảng 6 cột & Camera OCR trích xuất tự động
            </div>
          </div>
          <div
            className={`p-2.5 rounded-lg border ${
              currentStepStatus === "CHECKING"
                ? "border-amber-400 bg-slate-800"
                : "border-slate-700 bg-slate-800/50"
            }`}
          >
            <div className="font-bold text-amber-400">Bước 3 & 4</div>
            <div className="text-slate-300 text-[11px]">
              Chốt dự kiến & Quét Tag / Tìm kiếm kiểm thực tế
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-700 bg-slate-800/50">
            <div className="font-bold text-blue-400">Bước 5 & 6</div>
            <div className="text-slate-300 text-[11px]">
              Tổng kết chênh lệch, Tick xác nhận & Lưu nháp
            </div>
          </div>
          <div
            className={`p-2.5 rounded-lg border ${
              currentStepStatus === "COMPLETED"
                ? "border-emerald-400 bg-emerald-950/60"
                : "border-slate-700 bg-slate-800/50"
            }`}
          >
            <div className="font-bold text-emerald-400">Bước 7</div>
            <div className="text-slate-300 text-[11px]">
              Hoàn thành đẩy vào Kho & Khóa phiếu
            </div>
          </div>
        </div>
      </div>

      {/* Thông báo trạng thái */}
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            statusMsg.type === "success"
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

      {/* Khung thông tin chung & Thanh công cụ Camera / Kiểm hàng */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Ghi chú Phiếu nhập kho
            </label>
            <input
              type="text"
              disabled={isCompleted}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Nhập lô hàng quần áo thể thao đợt 1..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold uppercase text-emerald-700 mb-1">
              Nhập vào Kho (Chọn Tầng) *
            </label>
            <select
              disabled={isCompleted}
              value={targetWarehouse}
              onChange={(e) =>
                setTargetWarehouse(
                  e.target.value === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1"
                )
              }
              className="w-full px-3 py-2 rounded-lg border-2 border-emerald-600 text-sm font-bold text-slate-900 bg-emerald-50/40 disabled:bg-slate-100"
            >
              <option value="FLOOR_1">🏢 Kho Tầng 1</option>
              <option value="FLOOR_2">🏬 Kho Tầng 2</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Category mặc định (Cho SP mới)
            </label>
            <select
              disabled={isCompleted}
              value={defaultCategoryId}
              onChange={(e) => setDefaultCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white disabled:bg-slate-100"
            >
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Các nút thao tác chính của Bước 2, 3, 4 */}
        {!isCompleted && (
          <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            {currentStepStatus === "DRAFT" ? (
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                {/* Bước 2: Nút Kiểm hàng Camera OCR (hỗ trợ chụp/tải nhiều ảnh để cộng dồn) */}
                <button
                  type="button"
                  onClick={() => setOpenOcrModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  {items.some((i) => i.productName.trim() !== "")
                    ? "📷 Chụp / Quét thêm ảnh Kiểm hàng (+)"
                    : "📷 Kiểm hàng (Chụp / Tải nhiều ảnh OCR)"}
                </button>

                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Thêm dòng mới
                </button>
              </div>
            ) : (
              <div className="text-xs font-semibold text-slate-600">
                Đã chốt danh sách kiểm hàng — quét Tag để tick xác nhận từng dòng.
              </div>
            )}

            {/* Bước 4: Tìm kiếm nhanh & Quét Tag kiểm tra thực tế */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={quickCheckSearch}
                  onChange={(e) => setQuickCheckSearch(e.target.value)}
                  placeholder="Tìm nhanh mã/tên trong phiếu..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-base sm:text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {currentStepStatus === "CHECKING" && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleOpenTagScanner}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Camera className="w-4 h-4" />
                  📷 Quét Tag Kiểm Tra Thực Tế (liên tục)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Thanh Thống kê Bước 5 (Tổng kết Kiểm hàng & Chênh lệch) */}
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
            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold">
              Thiếu: {shortageRows}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold">
              Thừa / Phát sinh: {surplusRows}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold">
              Đã tick xác nhận nhập kho: {confirmedRows}/{totalRows}
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
                <CheckSquare className="w-3.5 h-3.5" /> Kiểm & Tick chọn tất cả
              </button>
            </div>
          )}
        </div>

        {/* BẢNG 6 CỘT CHUẨN + CỘT KIỂM THỰC TẾ & TICK XÁC NHẬN (Hiển thị đầy đủ thông tin) */}
        <div
          className={`overflow-x-auto border border-slate-200 rounded-xl transition-all ${
            activeSuggestRowIdx !== null ? "pb-64" : ""
          }`}
        >
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="py-3 px-2 text-center w-11">STT</th>
                <th className="hidden py-3 px-3 min-w-[200px]">
                  MÃ HÀNG (Tự sinh từ `()`)
                </th>
                <th className="py-3 px-2.5 min-w-[230px]">TÊN HÀNG</th>
                <th className="py-3 px-2 w-24 min-w-[88px] text-center">
                  ĐVT
                </th>
                <th className="py-3 px-2 w-28 min-w-[96px] text-right">
                  SỐ LƯỢNG
                </th>
                <th
                  className="py-3 px-2.5 w-36 min-w-[140px] text-right"
                  title="Giá gốc (đơn giá nhập, VND)"
                >
                  GIÁ GỐC (VND)
                </th>
                <th
                  className="py-3 px-2.5 w-36 min-w-[140px] text-right text-emerald-300"
                  title="Giá bán niêm yết (VND) do Thủ kho hoặc Quản lý nhập"
                >
                  GIÁ BÁN (VND)
                </th>
                <th className="py-3 px-2.5 min-w-[180px]">GHI CHÚ</th>
                <th className="py-3 px-2.5 w-44 min-w-[170px] bg-slate-800 text-amber-300">
                  BƯỚC 4: KIỂM THỰC TẾ
                </th>
                <th className="py-3 px-2 w-28 min-w-[105px] bg-slate-800 text-emerald-300 text-center">
                  BƯỚC 5: XÁC NHẬN
                </th>
                {!isCompleted && <th className="py-3 px-2 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.map(({ item: row, idx }) => {
                const diff = row.actualQuantity - row.expectedQuantity;
                return (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50 ${
                      row.isConfirmed ? "bg-emerald-50/30" : ""
                    }`}
                  >
                    {/* Cột 1: STT */}
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700 align-top pt-4">
                      {idx + 1}
                    </td>

                    {/* Cột 2: MÃ HÀNG (Read-only, tự sinh từ ngoặc đơn trong Tên hàng - ẩn UI giữ nguyên logic) */}
                    <td className="hidden py-2.5 px-3">
                      <input
                        type="text"
                        value={row.productCode}
                        readOnly
                        placeholder="Tự sinh từ ()..."
                        className="w-full bg-slate-100 text-slate-900 font-mono text-[11px] font-bold px-2.5 py-1.5 rounded border border-slate-300"
                      />
                    </td>

                    {/* Cột 3: TÊN HÀNG (Hiển thị đầy đủ, tự động xuống dòng + gợi ý sản phẩm có trong kho) */}
                    <td className="py-2.5 px-2.5 align-top">
                      <div className="relative">
                        <textarea
                          disabled={isCompleted}
                          rows={Math.max(
                            2,
                            Math.ceil((row.productName?.length || 0) / 42)
                          )}
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
                              setSuggestHighlightIdx((prev) =>
                                (prev + 1) % suggestions.length
                              );
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setSuggestHighlightIdx((prev) =>
                                (prev - 1 + suggestions.length) % suggestions.length
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
                          placeholder="Gõ tên hoặc mã hàng để tìm gợi ý SP trong kho..."
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100 whitespace-pre-wrap break-words leading-snug resize-y font-medium text-slate-900"
                        />

                        {/* Dropdown gợi ý sản phẩm có sẵn trong kho */}
                        {!isCompleted &&
                          activeSuggestRowIdx === idx &&
                          (() => {
                            const suggestions = getRowProductSuggestions(row.productName);
                            if (suggestions.length === 0) return null;
                            return (
                              <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-xl border-2 border-emerald-500 shadow-2xl overflow-hidden min-w-[320px] sm:min-w-[420px]">
                                <div className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold flex items-center justify-between gap-2">
                                  <span>
                                    📦 Gợi ý sản phẩm trong kho ({suggestions.length} SP phù hợp)
                                  </span>
                                  <span className="text-emerald-300 font-normal">
                                    Bấm chọn hoặc nhấn ↑↓ + Enter
                                  </span>
                                </div>
                                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                                  {suggestions.map((p, sIdx) => {
                                    const f1 = Number(p.stockFloor1 ?? p.stock ?? 0);
                                    const f2 = Number(p.stockFloor2 ?? 0);
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
                                        className={`w-full text-left px-3 py-2 transition flex flex-col gap-0.5 ${
                                          isHighlighted
                                            ? "bg-emerald-50/90"
                                            : "hover:bg-slate-50"
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
                            );
                          })()}
                      </div>
                      {row.productCode && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span>Mã SP:</span>
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {row.productCode}
                          </span>
                          {(() => {
                            const existingProd = catalogByCode.get(row.productCode);
                            if (!existingProd) return null;
                            return (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                                ✓ Đã có trong kho (Tồn: {existingProd.stock} {existingProd.unit || "Cái"})
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </td>

                    {/* Cột 4: ĐVT (Đủ rộng để hiển thị trọn chữ Cây, Cái, Đôi, Bộ...) */}
                    <td className="py-2.5 px-2 align-top">
                      <input
                        type="text"
                        disabled={isCompleted}
                        value={row.unit}
                        onChange={(e) =>
                          handleUpdateRow(idx, "unit", e.target.value)
                        }
                        placeholder="ĐVT"
                        className="w-full min-w-[72px] px-2 py-1.5 rounded border border-slate-300 text-center font-medium text-slate-900 disabled:bg-slate-100"
                      />
                    </td>

                    {/* Cột 5: SỐ LƯỢNG (Dự kiến trên chứng từ) */}
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
                        className="w-full min-w-[78px] px-2.5 py-1.5 rounded border border-slate-300 text-right font-mono font-bold text-slate-900 disabled:bg-slate-100"
                      />
                    </td>

                    {/* GIÁ GỐC: đơn giá nhập do thủ kho nhập */}
                    <td className="py-2.5 px-2.5 align-top">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={isCompleted}
                          value={
                            Number(row.costPrice) > 0
                              ? formatNumberDots(row.costPrice)
                              : ""
                          }
                          onChange={(e) =>
                            handleUpdateRow(
                              idx,
                              "costPrice",
                              parseNumberDots(e.target.value)
                            )
                          }
                          placeholder="0"
                          className={`w-full pl-2 pr-10 py-1.5 rounded border text-right font-mono font-bold disabled:bg-slate-100 ${
                            Number(row.costPrice) > 0 ||
                            !row.productName.trim()
                              ? "border-slate-300"
                              : "border-orange-300 bg-orange-50"
                          }`}
                        />
                        <span className="absolute right-2 top-2 text-[10px] font-mono font-bold text-slate-400 pointer-events-none">
                          VND
                        </span>
                      </div>
                      {Number(row.costPrice) > 0 && (
                        <div className="mt-1 text-[11px] text-right font-semibold text-slate-600 whitespace-nowrap">
                          ={" "}
                          {formatVND(
                            (Number(row.costPrice) || 0) *
                              (Number(row.actualQuantity) || 0)
                          )}
                        </div>
                      )}
                    </td>

                    {/* GIÁ BÁN: đơn giá bán niêm yết do thủ kho / quản lý nhập */}
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
                            handleUpdateRow(
                              idx,
                              "sellingPrice",
                              parseNumberDots(e.target.value)
                            )
                          }
                          placeholder="0"
                          className={`w-full pl-2 pr-10 py-1.5 rounded border text-right font-mono font-bold text-emerald-900 disabled:bg-slate-100 ${
                            Number(row.sellingPrice) > 0 ||
                            !row.productName.trim()
                              ? "border-emerald-300 bg-white"
                              : "border-amber-300 bg-amber-50/60"
                          }`}
                        />
                        <span className="absolute right-2 top-2 text-[10px] font-mono font-bold text-slate-400 pointer-events-none">
                          VND
                        </span>
                      </div>
                      {Number(row.sellingPrice) > 0 && (
                        <div className="mt-1 text-[11px] text-right font-semibold text-emerald-700 whitespace-nowrap">
                          ={" "}
                          {formatVND(
                            (Number(row.sellingPrice) || 0) *
                              (Number(row.actualQuantity) || 0)
                          )}
                        </div>
                      )}
                    </td>

                    {/* Cột 6: GHI CHÚ (Tự xuống dòng để không bị khuất nội dung) */}
                    <td className="py-2.5 px-2.5 align-top">
                      <textarea
                        disabled={isCompleted}
                        rows={Math.max(
                          2,
                          Math.ceil((row.note?.length || 0) / 26)
                        )}
                        value={row.note}
                        onChange={(e) =>
                          handleUpdateRow(idx, "note", e.target.value)
                        }
                        placeholder="Ghi chú..."
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100 whitespace-pre-wrap break-words leading-snug resize-y"
                      />
                    </td>

                    {/* Bước 4: Kiểm thực tế (SL thực nhận + trạng thái quét đầy đủ) */}
                    <td className="py-2.5 px-2.5 bg-amber-50/40 align-top">
                      <div className="flex items-center justify-between gap-1.5">
                        <input
                          type="number"
                          min={0}
                          disabled={isCompleted}
                          value={row.actualQuantity}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            handleUpdateRow(idx, "actualQuantity", val);
                          }}
                          className="w-20 px-2 py-1.5 rounded border border-amber-400 text-right font-mono font-bold bg-white"
                          title="Số lượng thực nhận"
                        />
                        {row.isChecked && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold whitespace-nowrap ${
                              diff === 0
                                ? "bg-emerald-100 text-emerald-800"
                                : diff > 0
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {diff === 0
                              ? "Khớp đủ"
                              : diff > 0
                              ? `+${diff} Thừa`
                              : `${diff} Thiếu`}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 text-[11px] space-y-0.5">
                        {Number(row.scannedQuantity) > 0 ? (
                          <span
                            className={`font-bold inline-block ${
                              Number(row.scannedQuantity) >=
                              row.expectedQuantity
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }`}
                          >
                            📷 Đã quét {row.scannedQuantity}/
                            {row.expectedQuantity}
                          </span>
                        ) : row.isChecked ? (
                          <span className="font-bold text-emerald-700">
                            ✓ Đã kiểm thực tế
                          </span>
                        ) : (
                          <span className="text-slate-400">Chưa kiểm</span>
                        )}
                        {row.checkedByName && (
                          <div className="text-[10px] text-slate-600 flex flex-wrap items-center gap-1">
                            <span>Kiểm: {row.checkedByName}</span>
                            <RoleBadge
                              role={row.checkedByRole}
                              name={row.checkedByName}
                              userId={row.checkedBy}
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Bước 5: Tick xác nhận đẩy vào kho */}
                    <td className="py-2.5 px-2 text-center bg-emerald-50/40 align-top pt-3">
                      <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isCompleted}
                          checked={row.isConfirmed}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            handleUpdateRow(idx, "isConfirmed", checked);
                            if (checked) {
                              handleUpdateRow(idx, "isChecked", true);
                            }
                          }}
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        <span
                          className={`text-[10px] font-bold whitespace-nowrap ${
                            row.isConfirmed
                              ? "text-emerald-800"
                              : "text-slate-500"
                          }`}
                        >
                          {row.isConfirmed ? "✓ Nhập kho" : "Chưa chọn"}
                        </span>
                      </label>
                    </td>

                    {!isCompleted && (
                      <td className="py-2.5 px-1.5 text-center align-top pt-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          title="Xóa dòng"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Thanh hành động cuối phiếu: Lưu nháp (Bước 6), Hoàn tất DS (Bước 3), Hoàn thành nhập kho (Bước 7) */}
        {isCompleted ? (
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700">
            <div className="flex items-start sm:items-center gap-2 font-bold">
              <Lock className="w-4 h-4 text-slate-600 shrink-0" />
              Phiếu nhập này đã HOÀN THÀNH và bị khóa vĩnh viễn (BR-10). Nếu phát hiện sai lệch, vui lòng lập Phiếu Điều Chỉnh Kho trên CMS.
            </div>
            {currentReceipt && (
              <button
                type="button"
                onClick={() => setDetailModalReceipt(currentReceipt)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <Eye className="w-4 h-4" /> Xem lại chi tiết phiếu nhập
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
            {/* Bước 6: Nút Lưu nháp duy nhất (chỉ active khi có thay đổi thực tế) & Xóa phiếu */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loading || !hasReceiptChanges || validItemCount === 0}
                onClick={handleSaveDraft}
                className={`px-5 py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition ${
                  hasReceiptChanges && validItemCount > 0 && !loading
                    ? "border-2 border-blue-600 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    : "border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
                title={
                  hasReceiptChanges && validItemCount > 0
                    ? "Lưu các thay đổi của phiếu nhập"
                    : "Chưa có thay đổi nào để lưu"
                }
              >
                <Save className="w-4 h-4" />
                {hasReceiptChanges && validItemCount > 0
                  ? "💾 Lưu thay đổi (Bước 6)"
                  : "💾 Đã lưu (Chưa có thay đổi)"}
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
              {/* Bước 3: Nút Hoàn tất danh sách dự kiến */}
              {currentStepStatus === "DRAFT" && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleFinishListing}
                  className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow"
                >
                  ➡️ Hoàn tất kiểm hàng (Mở camera quét Tag)
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {/* Bước 7: Nút Hoàn thành nhập kho */}
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

      {/* MỤC XEM LẠI CHI TIẾT KHI NHẬP HÀNG VÀO KHO (Lịch sử & Tra cứu chi tiết phiếu nhập + Người nhập ADMIN / WAREHOUSE) */}
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
              Lưu đầy đủ thông tin người nhập (Admin hay Warehouse), số lượng dự kiến / thực nhận, giá nhập / giá bán và chi tiết từng dòng hàng.
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
              <option value="CHECKING">Đang kiểm thực tế</option>
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
                <th className="py-2.5 px-3 text-right">Số dòng / Tổng SL thực nhận</th>
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
                    (s, i) =>
                      s + Number(i.costPrice || 0) * Number(i.actualQuantity || 0),
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
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rc.targetWarehouse === "FLOOR_2"
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
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rc.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800"
                                : rc.status === "CHECKING"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {rc.status === "COMPLETED"
                              ? "HOÀN THÀNH"
                              : rc.status === "CHECKING"
                              ? "ĐANG KIỂM"
                              : "NHÁP"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className="font-bold text-slate-900">
                            {rcItems.length} SP
                          </span>{" "}
                          •{" "}
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
                              <Eye className="w-3.5 h-3.5" /> Xem chi tiết
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
                                      <th className="py-1.5 px-2">Mã SP</th>
                                      <th className="py-1.5 px-2">Tên sản phẩm</th>
                                      <th className="py-1.5 px-2 text-center">ĐVT</th>
                                      <th className="py-1.5 px-2 text-right">SL Dự kiến</th>
                                      <th className="py-1.5 px-2 text-right">SL Thực nhận</th>
                                      <th className="py-1.5 px-2 text-right">Giá gốc</th>
                                      <th className="py-1.5 px-2 text-right">Giá bán</th>
                                      <th className="py-1.5 px-2">Người kiểm / Ghi chú</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {rcItems.map((it, i) => (
                                      <tr key={i}>
                                        <td className="py-1.5 px-2 font-mono">{i + 1}</td>
                                        <td className="py-1.5 px-2 font-mono font-bold text-slate-700">
                                          {it.productCode}
                                        </td>
                                        <td className="py-1.5 px-2 font-semibold text-slate-900">
                                          {it.productName}
                                        </td>
                                        <td className="py-1.5 px-2 text-center">{it.unit}</td>
                                        <td className="py-1.5 px-2 text-right font-mono">
                                          {it.expectedQuantity}
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-700">
                                          {it.actualQuantity}
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-mono">
                                          {formatVND(it.costPrice || 0)}
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-mono text-emerald-700 font-semibold">
                                          {formatVND(it.sellingPrice || 0)}
                                        </td>
                                        <td className="py-1.5 px-2 text-slate-600">
                                          {it.checkedByName && (
                                            <div className="flex flex-wrap items-center gap-1">
                                              <span className="font-semibold text-slate-800">
                                                {it.checkedByName}
                                              </span>
                                              <RoleBadge
                                                role={it.checkedByRole}
                                                name={it.checkedByName}
                                                userId={it.checkedBy}
                                              />
                                            </div>
                                          )}
                                          {it.discrepancyNote || it.note || "-"}
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
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      detailModalReceipt.status === "COMPLETED"
                        ? "bg-emerald-500 text-slate-950"
                        : detailModalReceipt.status === "CHECKING"
                        ? "bg-amber-400 text-slate-950"
                        : "bg-blue-500 text-white"
                    }`}
                  >
                    {detailModalReceipt.status === "COMPLETED"
                      ? "ĐÃ HOÀN THÀNH"
                      : detailModalReceipt.status === "CHECKING"
                      ? "ĐANG KIỂM THỰC TẾ"
                      : "NHÁP (DRAFT)"}
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
              {/* Thông tin người nhập (Admin / Warehouse) & Thời gian */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <div className="text-slate-500 font-semibold">Người lập phiếu nhập</div>
                  <div className="font-extrabold text-slate-900 mt-1 flex flex-wrap items-center gap-1.5">
                    <span>{detailModalReceipt.createdByName || "Thủ kho"}</span>
                    <RoleBadge
                      role={detailModalReceipt.createdByRole}
                      name={detailModalReceipt.createdByName}
                      userId={detailModalReceipt.createdBy}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Lúc: {formatDateTime(detailModalReceipt.createdAt)}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 font-semibold">Người hoàn thành nhập kho</div>
                  {detailModalReceipt.status === "COMPLETED" ? (
                    <>
                      <div className="font-extrabold text-emerald-900 mt-1 flex flex-wrap items-center gap-1.5">
                        <span>
                          {detailModalReceipt.completedByName ||
                            detailModalReceipt.createdByName ||
                            "Thủ kho"}
                        </span>
                        <RoleBadge
                          role={
                            detailModalReceipt.completedByRole ||
                            detailModalReceipt.createdByRole
                          }
                          name={
                            detailModalReceipt.completedByName ||
                            detailModalReceipt.createdByName
                          }
                          userId={
                            detailModalReceipt.completedBy ||
                            detailModalReceipt.createdBy
                          }
                        />
                      </div>
                      {detailModalReceipt.completedAt && (
                        <div className="text-[11px] text-emerald-700 mt-0.5">
                          Lúc: {formatDateTime(detailModalReceipt.completedAt)}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-slate-400 italic mt-1">
                      Phiếu chưa hoàn thành
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-slate-500 font-semibold">Tổng số lượng nhập</div>
                  <div className="font-mono font-extrabold text-sm text-slate-900 mt-1">
                    {(detailModalReceipt.items || []).reduce(
                      (s, i) => s + Number(i.actualQuantity || 0),
                      0
                    )}{" "}
                    /{" "}
                    {(detailModalReceipt.items || []).reduce(
                      (s, i) => s + Number(i.expectedQuantity || 0),
                      0
                    )}{" "}
                    SP ({(detailModalReceipt.items || []).length} dòng)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Đã xác nhận:{" "}
                    {(detailModalReceipt.items || []).filter((i) => i.isConfirmed).length}/
                    {(detailModalReceipt.items || []).length} dòng
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 font-semibold">Tổng giá trị lô nhập</div>
                  <div className="font-mono font-extrabold text-sm text-amber-800 mt-1">
                    Vốn:{" "}
                    {formatVND(
                      (detailModalReceipt.items || []).reduce(
                        (s, i) =>
                          s + Number(i.costPrice || 0) * Number(i.actualQuantity || 0),
                        0
                      )
                    )}
                  </div>
                  <div className="font-mono font-bold text-[11px] text-emerald-700 mt-0.5">
                    Giá bán:{" "}
                    {formatVND(
                      (detailModalReceipt.items || []).reduce(
                        (s, i) =>
                          s +
                          Number(i.sellingPrice || 0) * Number(i.actualQuantity || 0),
                        0
                      )
                    )}
                  </div>
                </div>
              </div>

              {detailModalReceipt.note && (
                <div className="text-xs bg-amber-50/70 border border-amber-200 rounded-lg px-3.5 py-2 text-slate-800">
                  <strong>Ghi chú phiếu:</strong> {detailModalReceipt.note}
                </div>
              )}

              {/* Bảng chi tiết từng dòng hàng đã nhập */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-white uppercase">
                    <tr>
                      <th className="py-2.5 px-2.5 text-center">STT</th>
                      <th className="py-2.5 px-3">Mã hàng</th>
                      <th className="py-2.5 px-3">Tên sản phẩm</th>
                      <th className="py-2.5 px-2 text-center">ĐVT</th>
                      <th className="py-2.5 px-2.5 text-right">SL Dự kiến</th>
                      <th className="py-2.5 px-2.5 text-right">SL Thực nhận</th>
                      <th className="py-2.5 px-2.5 text-right">Giá gốc</th>
                      <th className="py-2.5 px-2.5 text-right">Thành tiền vốn</th>
                      <th className="py-2.5 px-2.5 text-right">Giá bán</th>
                      <th className="py-2.5 px-3">Người kiểm & Đối chiếu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(detailModalReceipt.items || []).map((it, idx) => {
                      const diff =
                        Number(it.actualQuantity || 0) -
                        Number(it.expectedQuantity || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-2.5 text-center font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                            {it.productCode}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {it.productName}
                            {it.note && (
                              <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                                Ghi chú: {it.note}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center">{it.unit}</td>
                          <td className="py-2.5 px-2.5 text-right font-mono">
                            {it.expectedQuantity}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono font-extrabold text-emerald-700">
                            {it.actualQuantity}
                            {it.isChecked && (
                              <span
                                className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
                                  diff === 0
                                    ? "bg-emerald-100 text-emerald-800"
                                    : diff > 0
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {diff === 0
                                  ? "Khớp"
                                  : diff > 0
                                  ? `+${diff}`
                                  : `${diff}`}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono">
                            {formatVND(it.costPrice || 0)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono font-bold text-amber-900">
                            {formatVND(
                              Number(it.costPrice || 0) *
                                Number(it.actualQuantity || 0)
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-emerald-700">
                            {formatVND(it.sellingPrice || 0)}
                          </td>
                          <td className="py-2.5 px-3">
                            {it.checkedByName ? (
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="font-bold text-slate-800">
                                  {it.checkedByName}
                                </span>
                                <RoleBadge
                                  role={it.checkedByRole}
                                  name={it.checkedByName}
                                  userId={it.checkedBy}
                                />
                              </div>
                            ) : (
                              <span className="text-slate-400">
                                {it.isConfirmed ? "Đã xác nhận" : "Chưa kiểm"}
                              </span>
                            )}
                            {it.discrepancyNote && (
                              <div className="text-[11px] text-slate-600 mt-0.5">
                                {it.discrepancyNote}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
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
                onClick={() => setDetailModalReceipt(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Camera OCR Bảng 6 cột (hỗ trợ chụp/tải nhiều ảnh và cộng thêm vào phiếu) */}
      {openOcrModal && (
        <CameraScannerModal
          mode="OCR_TABLE"
          existingItemCount={items.filter((i) => i.productName.trim() !== "").length}
          catalogProducts={catalogProducts}
          onConfirmOcrItems={(scannedItems, modeAction) => {
            const hasExisting = items.some((i) => i.productName.trim() !== "");
            if (modeAction === "append" && hasExisting) {
              const { merged, addedRows, mergedRows } = mergeOcrItemsList(items, scannedItems, true);
              setItems(merged);
              const mergeNote =
                mergedRows > 0 ? ` (+cộng dồn SL cho ${mergedRows} dòng trùng mã)` : "";
              setStatusMsg({
                type: "success",
                text: `Đã cộng thêm ${addedRows} dòng mới${mergeNote} từ Camera OCR vào phiếu (tổng ${merged.length} dòng)!`,
              });
            } else {
              setItems(
                scannedItems.map((it, i) => ({
                  ...it,
                  stt: i + 1,
                  productCode: it.productCode || generateProductCode(it.productName),
                }))
              );
              setStatusMsg({
                type: "success",
                text: `Đã nạp ${scannedItems.length} dòng hàng từ Camera OCR vào Bảng 6 Cột!`,
              });
            }
          }}
          onClose={() => setOpenOcrModal(false)}
        />
      )}

      {/* Modal Quét Tag kiểm thực tế — liên tục, chỉ đối chiếu & tick xác nhận */}
      {openTagModal && currentReceipt?._id && (
        <TagCheckScannerModal
          receiptId={currentReceipt._id}
          items={items}
          onReceiptUpdate={(rc) => handleSelectReceipt(rc)}
          onClose={() => {
            setOpenTagModal(false);
            loadInitialData();
          }}
        />
      )}
    </div>
  );
}
