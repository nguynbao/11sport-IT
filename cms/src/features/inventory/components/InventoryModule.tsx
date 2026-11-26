"use client";

import BarcodeLabelModal from "@/shared/ui/BarcodeLabelModal";
import ProductCodeCreatorModal from "@/shared/ui/ProductCodeCreatorModal";
import {
AlertCircle,
ArrowLeftRight,
BarChart3,
CheckCircle2,
ClipboardList,
History,
Package,
Plus,
X
} from "lucide-react";
import { useInventoryModule } from "../hooks/useInventoryModule";
import { COMMON_COLORS,COMMON_SIZES } from "../types";
import { AdminBatchImportModal } from "./AdminBatchImportModal";
import { ImportReceiptDetailModal } from "./ImportReceiptDetailModal";
import { InventoryHistoryTab } from "./InventoryHistoryTab";
import { InventoryProductsTab } from "./InventoryProductsTab";
import { InventoryReportTab } from "./InventoryReportTab";
import { InventoryTransferTab } from "./InventoryTransferTab";
import { SetLinkModal } from "./SetLinkModal";

export default function InventoryModule() {
  const vm = useInventoryModule();
  const {
    subTab,
    setSubTab,
    activeWarehouse,
    products,
    categories,
    importsList,
    categoryId,
    setShowAdminImportModal,
    newProdCatId,
    showCodeCreator,
    setShowCodeCreator,
    editingProductModal,
    setEditingProductModal,
    canSeeCost,
    showLabelModal,
    setShowLabelModal,
    labelItems,
    statusMsg,
    setStatusMsg,
    handleSelectWarehouseTab,
    handleCodeCreatorDone,
    totalFloor1Qty,
    totalFloor2Qty,
  } = vm;

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
          className="flex overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5 [&>button]:shrink-0 [&>button]:whitespace-nowrap"
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

      <InventoryProductsTab vm={vm} />
      <InventoryReportTab vm={vm} />
      <InventoryHistoryTab vm={vm} />
      <InventoryTransferTab vm={vm} />
      <ImportReceiptDetailModal vm={vm} />
      <AdminBatchImportModal vm={vm} />
      <SetLinkModal vm={vm} />
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
