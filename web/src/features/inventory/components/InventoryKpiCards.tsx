import { Package, Layers } from "lucide-react";
import type { InventoryCtx } from "./inventoryCtx";

type Props = Pick<InventoryCtx, "effectiveWarehouse" | "displayedProducts" | "totalStockFloor1" | "totalStockFloor2" | "totalStock">;

export default function InventoryKpiCards({ effectiveWarehouse, displayedProducts, totalStockFloor1, totalStockFloor2, totalStock }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
      <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">
            {effectiveWarehouse === "FLOOR_1"
              ? "Số Mã SP Kho Tầng 1"
              : effectiveWarehouse === "FLOOR_2"
                ? "Số Mã SP Kho Tầng 2"
                : "Tổng số Mã sản phẩm chung"}
          </p>
          <p className="text-2xl md:text-3xl font-extrabold font-mono text-slate-900 mt-1">
            {displayedProducts.length}
          </p>
        </div>
        <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-50 text-brand-ink flex items-center justify-center">
          <Package className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">
            {effectiveWarehouse === "FLOOR_1"
              ? "🏢 Tồn Kho Tầng 1"
              : effectiveWarehouse === "FLOOR_2"
                ? "🏬 Tồn Kho Tầng 2"
                : "Tổng tồn cả 2 kho"}
          </p>
          <p className="text-2xl md:text-3xl font-extrabold font-mono text-brand-ink mt-1">
            {effectiveWarehouse === "FLOOR_1"
              ? totalStockFloor1
              : effectiveWarehouse === "FLOOR_2"
                ? totalStockFloor2
                : totalStock}
          </p>
        </div>
        <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-50 text-brand-ink flex items-center justify-center">
          <Layers className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-blue-50/80 border border-blue-200 text-slate-800 rounded-xl p-4 md:p-5 shadow-sm flex flex-col justify-center sm:col-span-2 lg:col-span-1">
        <p className="text-xs font-bold uppercase text-brand-ink">
          Quy chuẩn 1 Mã Chung • Đa Màu & Size (v2.8)
        </p>
        <p className="text-xs text-slate-600 mt-1">
          Mỗi dòng sản phẩm dùng <b>1 Mã IN HOA VIẾT LIỀN</b> duy nhất (in lên tem mã vạch). Bấm vào từng dòng để xem hoặc thêm chi tiết <b>Màu sắc • Size • Số lượng</b>.
        </p>
      </div>
    </div>
  );
}
