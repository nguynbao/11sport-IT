"use client";

import { CheckCircle2 } from "lucide-react";
import BarcodeLabelModal from "@/shared/ui/BarcodeLabelModal";
import ProductCodeCreatorModal from "@/shared/ui/ProductCodeCreatorModal";
import { useInventoryTab } from "../hooks/useInventoryTab";
import { useClientPagination } from "@/shared/hooks/useClientPagination";
import { PaginationBar } from "@/shared/ui/PaginationBar";
import InventoryWarehouseSwitcher from "./InventoryWarehouseSwitcher";
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
    effectiveWarehouse,
    totalStockFloor1,
    totalStockFloor2,
    totalStock,
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

  const activeWarehouseLabel =
    effectiveWarehouse === "FLOOR_1"
      ? "Kho Tầng 1"
      : effectiveWarehouse === "FLOOR_2"
        ? "Kho Tầng 2"
        : "Gộp cả 2 Kho";

  const totalStockQty =
    effectiveWarehouse === "FLOOR_1"
      ? totalStockFloor1
      : effectiveWarehouse === "FLOOR_2"
        ? totalStockFloor2
        : totalStock;

  return (
    <div className="space-y-4">
      {/* HEADER GỌN GÀNG GIỐNG CMS: CHỌN KHO TẦNG + TẠO SP MỚI */}
      <InventoryWarehouseSwitcher {...ctx} />

      {/* DANH MỤC SẢN PHẨM (GIAO DIỆN GỌN NHƯ CMS) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex flex-wrap items-center gap-2">
              <span>Danh mục Sản phẩm — {activeWarehouseLabel}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-blue-100 text-brand-ink">
                {displayedProducts.length} mặt hàng · {totalStockQty.toLocaleString("vi-VN")} đơn vị
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {effectiveWarehouse === "FLOOR_1"
                ? "Đang xem tồn kho tại Kho Tầng 1 (Kho bán lẻ & trưng bày). Bấm vào từng dòng để xem chi tiết Màu sắc • Size • SL."
                : effectiveWarehouse === "FLOOR_2"
                  ? "Đang xem tồn kho tại Kho Tầng 2 (Kho dự trữ). Bấm vào từng dòng để xem chi tiết Màu sắc • Size • SL."
                  : "Đang xem gộp cả 2 kho: hiển thị riêng cột Tồn Tầng 1, Tồn Tầng 2 và Tổng 2 Kho trên cùng một dòng."}
            </p>
          </div>
        </div>

        <InventoryToolbar {...ctx} />

        <InventoryScannerPanel {...ctx} />

        {priceStatusMsg && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-brand-ink text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-brand-ink" />
            <span>{priceStatusMsg}</span>
          </div>
        )}

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
