"use client";

import { CheckCircle2 } from "lucide-react";
import BarcodeLabelModal from "@/shared/ui/BarcodeLabelModal";
import ProductCodeCreatorModal from "@/shared/ui/ProductCodeCreatorModal";
import { useInventoryTab } from "../hooks/useInventoryTab";
import { useClientPagination } from "@/shared/hooks/useClientPagination";
import { PaginationBar } from "@/shared/ui/PaginationBar";
import InventoryWarehouseSwitcher from "./InventoryWarehouseSwitcher";
import InventoryKpiCards from "./InventoryKpiCards";
import InventoryToolbar from "./InventoryToolbar";
import InventoryScannerPanel from "./InventoryScannerPanel";
import InventoryTable from "./InventoryTable";

export default function InventoryTab() {
  const ctx = useInventoryTab();
  const {
    categories,
    selectedCategory,
    priceStatusMsg,
    labelModalItems,
    setLabelModalItems,
    showCodeCreator,
    setShowCodeCreator,
    currentUser,
    canSeeCostPrice,
    handleCodeCreatorDone,
    displayedProducts,
  } = ctx;

  const {
    page,
    pageSize,
    total,
    totalPages,
    items: pagedProducts,
    setPage,
    setPageSize,
  } = useClientPagination(displayedProducts, 20);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* BỘ CHUYỂN KHO TẦNG 1 & KHO TẦNG 2 (Ẩn Kho Tầng 2 đối với Saler) */}
      <InventoryWarehouseSwitcher {...ctx} />

      {/* Thẻ KPI Tổng số sản phẩm & Tổng tồn kho */}
      <InventoryKpiCards {...ctx} />

      {/* Bộ lọc & Tìm kiếm */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4 space-y-3">
        <InventoryToolbar {...ctx} />

        {/* THANH MÁY QUÉT LABEL — QUÉT KIỂM HÀNG & ĐỐI CHIẾU TỒN KHO TRÊN KỆ */}
        <InventoryScannerPanel {...ctx} />

        {priceStatusMsg && (
          <div className="mb-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-brand-ink text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-brand-ink" />
            <span>{priceStatusMsg}</span>
          </div>
        )}

        {/* Bảng tồn kho */}
        <InventoryTable {...ctx} pagedProducts={pagedProducts} />
        <PaginationBar
          totalItems={total}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="sản phẩm"
          showAllOption
        />
      </div>

      {/* Modal In Tem Mã Vạch (Label Printer) */}
      <ProductCodeCreatorModal
        open={showCodeCreator}
        onClose={() => setShowCodeCreator(false)}
        categories={categories}
        defaultCategoryId={selectedCategory || undefined}
        canSeeCost={canSeeCostPrice || currentUser?.role === "ACCOUNTANT"}
        onDone={handleCodeCreatorDone}
      />
      <BarcodeLabelModal
        open={Boolean(labelModalItems)}
        onClose={() => setLabelModalItems(null)}
        items={labelModalItems || []}
        title="In Tem Mã Vạch Sản Phẩm (Máy In Label)"
      />
    </div>
  );
}
