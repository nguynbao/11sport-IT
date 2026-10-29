"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ImportReceipt,
  ImportItem,
  Category,
  apiRequest,
  generateProductCode,
  formatDateTime,
  formatVND,
  formatNumberDots,
  parseNumberDots,
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
} from "lucide-react";

export default function ImportTab() {
  const [receipts, setReceipts] = useState<ImportReceipt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentReceipt, setCurrentReceipt] = useState<ImportReceipt | null>(null);

  // State form chỉnh sửa phiếu
  const [note, setNote] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [items, setItems] = useState<ImportItem[]>([
    {
      stt: 1,
      productName: "",
      productCode: "",
      unit: "Cái",
      expectedQuantity: 1,
      actualQuantity: 1,
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

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      const [impRes, catRes] = await Promise.all([
        apiRequest<ImportReceipt[]>("/imports"),
        apiRequest<Category[]>("/categories"),
      ]);
      const impList = Array.isArray(impRes.data) ? impRes.data : [];
      const catList = Array.isArray(catRes.data) ? catRes.data : [];
      setReceipts(impList);
      setCategories(catList);
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

  const handleSelectReceipt = (rc: ImportReceipt) => {
    setCurrentReceipt(rc);
    setNote(rc.note || "");
    setDefaultCategoryId(rc.defaultCategoryId || categories[0]?._id || "");
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
        scannedQuantity: Number(it.scannedQuantity || 0),
        note: it.note || "",
        isChecked: Boolean(it.isChecked),
        isConfirmed: Boolean(it.isConfirmed),
        discrepancyNote: it.discrepancyNote || "",
      }))
    );
    setStatusMsg(null);
  };

  const handleStartNewReceipt = () => {
    setCurrentReceipt(null);
    setNote("");
    setItems([
      {
        stt: 1,
        productName: "",
        productCode: "",
        unit: "Cái",
        expectedQuantity: 1,
        actualQuantity: 1,
        note: "",
        isChecked: false,
        isConfirmed: false,
        discrepancyNote: "",
      },
    ]);
    setStatusMsg(null);
  };

  const isCompleted = currentReceipt?.status === "COMPLETED";
  const currentStepStatus = currentReceipt?.status || "DRAFT";

  // Cập nhật từng ô trong bảng 6 cột (Tự sinh MÃ HÀNG từ () trong TÊN HÀNG)
  const handleUpdateRow = (index: number, field: keyof ImportItem, value: any) => {
    if (isCompleted) return;
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === "productName") {
        item.productCode = generateProductCode(String(value));
      }
      if (field === "expectedQuantity" && currentStepStatus === "DRAFT") {
        item.actualQuantity = Number(value) || 0;
      }
      next[index] = item;
      return next;
    });
  };

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
            items: saved.items,
          }),
        }
      );
      const completedReceipt: ImportReceipt = res.data?.receipt || res.data;
      handleSelectReceipt(completedReceipt);
      await loadInitialData();
      setStatusMsg({
        type: "success",
        text: `HOÀN THÀNH NHẬP KHO! Đã đẩy ${confirmedCount} dòng xác nhận vào tồn kho, ghi Sổ kho (StockMovement) và khóa phiếu.`,
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
  // Tổng giá trị nhập theo giá gốc (SL thực nhận × giá gốc)
  const totalCostValue = items.reduce(
    (sum, i) => sum + (Number(i.costPrice) || 0) * (Number(i.actualQuantity) || 0),
    0
  );
  const missingCostRows = items.filter(
    (i) => i.productName.trim() !== "" && !(Number(i.costPrice) > 0)
  ).length;

  const filteredItems = items.map((item, idx) => ({ item, idx })).filter(({ item }) => {
    if (!quickCheckSearch.trim()) return true;
    const q = quickCheckSearch.toLowerCase();
    return (
      item.productCode.toLowerCase().includes(q) ||
      item.productName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Cột trái (3 phần): Danh sách phiếu nhập kho */}
      <div className="lg:col-span-3 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 text-sm">Danh sách Phiếu Nhập</h3>
            <button
              type="button"
              onClick={handleStartNewReceipt}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
            >
              <FilePlus className="w-3.5 h-3.5" /> Tạo mới
            </button>
          </div>

          <div className="space-y-2 max-h-[260px] lg:max-h-[600px] overflow-y-auto">
            {receipts.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-6">
                Chưa có phiếu nhập nào
              </div>
            ) : (
              receipts.map((rc) => {
                const code = rc.code || rc.receiptCode || rc._id.slice(-6);
                const isSelected = currentReceipt?._id === rc._id;
                return (
                  <div
                    key={rc._id}
                    onClick={() => handleSelectReceipt(rc)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/60"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {code}
                      </span>
                      <div className="flex items-center gap-1">
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
                    <div className="text-xs text-slate-600 mt-1 truncate">
                      {rc.note || "Phiếu nhập kho"}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                      <span>{rc.items?.length || 0} mặt hàng</span>
                      <span>{formatDateTime(rc.createdAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Cột phải (9 phần): Quy trình Nhập kho 7 bước & Bảng 6 cột */}
      <div className="lg:col-span-9 space-y-4">
        {/* Thanh tiến trình 7 bước */}
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <span className="text-xs font-bold uppercase text-emerald-400">
                Quy trình Nhập Kho 7 Bước Chuẩn 11Sport
              </span>
              <h2 className="text-base font-extrabold mt-0.5">
                {currentReceipt
                  ? `Phiếu nhập: ${
                      currentReceipt.code || currentReceipt.receiptCode || currentReceipt._id
                    }`
                  : "Soạn Phiếu Nhập Kho Mới"}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold ${
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
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
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

            <div>
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
                <div className="relative w-full sm:w-60">
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
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs">
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
              {missingCostRows > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 font-bold">
                  Chưa nhập giá gốc: {missingCostRows} dòng
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

          {/* BẢNG 6 CỘT CHUẨN + CỘT KIỂM THỰC TẾ & TICK XÁC NHẬN */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white uppercase">
                <tr>
                  <th className="py-3 px-2.5 text-center w-10">STT</th>
                  <th className="hidden py-3 px-3 min-w-[220px]">MÃ HÀNG (Tự sinh từ `()`)</th>
                  <th className="py-3 px-3 min-w-[280px] sm:min-w-[360px]">TÊN HÀNG</th>
                  <th className="py-3 px-2.5 w-20 text-center">ĐVT</th>
                  <th className="py-3 px-2.5 w-24 text-right">SỐ LƯỢNG</th>
                  <th className="py-3 px-2.5 min-w-[150px] text-right" title="Giá gốc (đơn giá nhập). Giá bán do Quản lý/Admin cập nhật trên CMS">
                    GIÁ GỐC (VND)
                  </th>
                  <th className="py-3 px-3 min-w-[140px]">GHI CHÚ</th>
                  <th className="py-3 px-3 w-48 bg-slate-800 text-amber-300">
                    BƯỚC 4: KIỂM THỰC TẾ
                  </th>
                  <th className="py-3 px-2.5 w-28 bg-slate-800 text-emerald-300 text-center">
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
                      <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-700">
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

                      {/* Cột 3: TÊN HÀNG (Hiển thị đầy đủ, tự động xuống dòng) */}
                      <td className="py-2.5 px-3 align-top">
                        <textarea
                          disabled={isCompleted}
                          rows={Math.max(2, Math.ceil((row.productName?.length || 0) / 38))}
                          value={row.productName}
                          onChange={(e) =>
                            handleUpdateRow(idx, "productName", e.target.value)
                          }
                          placeholder="Nhập tên hàng kèm (chi tiết mã trong ngoặc đơn)..."
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100 whitespace-pre-wrap break-words leading-snug resize-y"
                        />
                      </td>

                      {/* Cột 4: ĐVT */}
                      <td className="py-2.5 px-2.5">
                        <input
                          type="text"
                          disabled={isCompleted}
                          value={row.unit}
                          onChange={(e) => handleUpdateRow(idx, "unit", e.target.value)}
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-center disabled:bg-slate-100"
                        />
                      </td>

                      {/* Cột 5: SỐ LƯỢNG (Dự kiến trên chứng từ) */}
                      <td className="py-2.5 px-2.5">
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
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-right font-mono font-bold disabled:bg-slate-100"
                        />
                      </td>

                      {/* GIÁ GỐC: đơn giá nhập do thủ kho nhập (giá bán do Quản lý/Admin đặt trên CMS) */}
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
                              Number(row.costPrice) > 0 || !row.productName.trim()
                                ? "border-slate-300"
                                : "border-orange-300 bg-orange-50"
                            }`}
                          />
                          <span className="absolute right-2 top-2 text-[10px] font-mono font-bold text-slate-400 pointer-events-none">
                            VND
                          </span>
                        </div>
                        {Number(row.costPrice) > 0 && (
                          <div className="mt-1 text-[10px] text-right text-slate-500">
                            = {formatVND((Number(row.costPrice) || 0) * (Number(row.actualQuantity) || 0))}
                          </div>
                        )}
                      </td>

                      {/* Cột 6: GHI CHÚ */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          disabled={isCompleted}
                          value={row.note}
                          onChange={(e) => handleUpdateRow(idx, "note", e.target.value)}
                          placeholder="Ghi chú..."
                          className="w-full px-2 py-1.5 rounded border border-slate-300 disabled:bg-slate-100"
                        />
                      </td>

                      {/* Bước 4: Kiểm thực tế (SL thực nhận + nút Quét Tag dòng) */}
                      <td className="py-2.5 px-3 bg-amber-50/40">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            disabled={isCompleted}
                            value={row.actualQuantity}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              handleUpdateRow(idx, "actualQuantity", val);
                              handleUpdateRow(idx, "isChecked", true);
                            }}
                            className="w-16 px-2 py-1 rounded border border-amber-300 text-right font-mono font-bold bg-white"
                            title="Số lượng thực nhận"
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px]">
                          {Number(row.scannedQuantity) > 0 ? (
                            <span
                              className={`font-bold ${
                                Number(row.scannedQuantity) >= row.expectedQuantity
                                  ? "text-emerald-700"
                                  : "text-amber-700"
                              }`}
                            >
                              📷 Đã quét {row.scannedQuantity}/{row.expectedQuantity}
                            </span>
                          ) : row.isChecked ? (
                            <span className="font-bold text-emerald-700">✓ Đã kiểm</span>
                          ) : (
                            <span className="text-slate-400">Chưa kiểm</span>
                          )}
                          {row.isChecked && (
                            <span
                              className={`font-mono font-bold ${
                                diff === 0
                                  ? "text-emerald-700"
                                  : diff > 0
                                  ? "text-amber-700"
                                  : "text-red-600"
                              }`}
                            >
                              {diff === 0
                                ? "Khớp"
                                : diff > 0
                                ? `+${diff} (Thừa)`
                                : `${diff} (Thiếu)`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Bước 5: Tick xác nhận đẩy vào kho */}
                      <td className="py-2.5 px-2.5 text-center bg-emerald-50/40">
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
                          <span className="text-[10px] font-bold text-slate-700">
                            {row.isConfirmed ? "Nhập kho" : "Chưa chọn"}
                          </span>
                        </label>
                      </td>

                      {!isCompleted && (
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
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
            <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-between text-xs text-slate-700">
              <div className="flex items-start sm:items-center gap-2 font-bold">
                <Lock className="w-4 h-4 text-slate-600 shrink-0" />
                Phiếu nhập này đã HOÀN THÀNH và bị khóa vĩnh viễn (BR-10). Nếu phát hiện sai lệch, vui lòng lập Phiếu Điều Chỉnh Kho trên CMS.
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
              {/* Bước 6: Nút Lưu nháp & Xóa phiếu */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSaveDraft}
                  className="px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4 text-blue-600" />
                  💾 Lưu nháp (Bước 6)
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
      </div>

      {/* Modal Camera OCR Bảng 6 cột (hỗ trợ chụp/tải nhiều ảnh và cộng thêm vào phiếu) */}
      {openOcrModal && (
        <CameraScannerModal
          mode="OCR_TABLE"
          existingItemCount={items.filter((i) => i.productName.trim() !== "").length}
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
