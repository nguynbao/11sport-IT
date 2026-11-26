import type { InventoryCtx } from "./inventoryCtx";

type Props = Pick<InventoryCtx, "isSales" | "effectiveWarehouse" | "setActiveWarehouse" | "totalStockFloor1" | "totalStockFloor2" | "totalStock">;

export default function InventoryWarehouseSwitcher({ isSales, effectiveWarehouse, setActiveWarehouse, totalStockFloor1, totalStockFloor2, totalStock }: Props) {
  return (
    <>
    {/* BỘ CHUYỂN KHO TẦNG 1 & KHO TẦNG 2 (Ẩn Kho Tầng 2 đối với Saler) */}
    {!isSales && (
      <div className="bg-white rounded-xl border-2 border-slate-300 shadow-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Phân chia Quản lý 2 Kho độc lập • 1 Mã chung chia theo Màu & Size
          </span>
          <h3 className="text-sm font-extrabold text-slate-900">
            Đang xem:{" "}
            {effectiveWarehouse === "FLOOR_1"
              ? "🏢 Kho Tầng 1 (Kho bán lẻ & trưng bày)"
              : effectiveWarehouse === "FLOOR_2"
                ? "🏬 Kho Tầng 2 (Kho dự trữ)"
                : "📊 Xem gộp cả 2 Kho (Tầng 1 + Tầng 2)"}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveWarehouse("FLOOR_1")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 border-2 ${effectiveWarehouse === "FLOOR_1"
              ? "bg-blue-600 text-white border-blue-700 shadow-sm"
              : "bg-blue-50/60 text-blue-900 border-blue-200 hover:bg-blue-100"
              }`}
          >
            <span>🏢 KHO TẦNG 1</span>
            <span
              className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${effectiveWarehouse === "FLOOR_1"
                ? "bg-white text-brand-ink"
                : "bg-blue-200 text-blue-900"
                }`}
            >
              {totalStockFloor1.toLocaleString("vi-VN")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveWarehouse("FLOOR_2")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 border-2 ${effectiveWarehouse === "FLOOR_2"
              ? "bg-blue-600 text-white border-blue-700 shadow-sm"
              : "bg-blue-50/60 text-blue-900 border-blue-200 hover:bg-blue-100"
              }`}
          >
            <span>🏬 KHO TẦNG 2</span>
            <span
              className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${effectiveWarehouse === "FLOOR_2"
                ? "bg-white text-brand-ink"
                : "bg-blue-200 text-blue-900"
                }`}
            >
              {totalStockFloor2.toLocaleString("vi-VN")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveWarehouse("ALL")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 border-2 ${effectiveWarehouse === "ALL"
              ? "bg-blue-600 text-white border-slate-900 shadow-sm"
              : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
              }`}
          >
            <span>📊 GỘP 2 KHO</span>
            <span
              className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${effectiveWarehouse === "ALL"
                ? "bg-white text-slate-900"
                : "bg-slate-200 text-slate-800"
                }`}
            >
              {totalStock.toLocaleString("vi-VN")}
            </span>
          </button>
        </div>
      </div>
    )}
    </>
  );
}
