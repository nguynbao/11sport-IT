import { Plus } from "lucide-react";
import type { InventoryCtx } from "./inventoryCtx";

type Props = Pick<
  InventoryCtx,
  | "isSales"
  | "effectiveWarehouse"
  | "setActiveWarehouse"
  | "totalStockFloor1"
  | "totalStockFloor2"
  | "totalStock"
  | "canCreateProduct"
  | "setShowCodeCreator"
>;

export default function InventoryWarehouseSwitcher({
  isSales,
  effectiveWarehouse,
  setActiveWarehouse,
  totalStockFloor1,
  totalStockFloor2,
  totalStock,
  canCreateProduct,
  setShowCodeCreator,
}: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
            Quản lý Kho
          </h2>

          {isSales ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs">
              <span>Kho Tầng 1</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                {totalStockFloor1.toLocaleString("vi-VN")}
              </span>
            </span>
          ) : (
            <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold gap-0.5">
              <button
                type="button"
                onClick={() => setActiveWarehouse("FLOOR_1")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 ${
                  effectiveWarehouse === "FLOOR_1"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Kho Tầng 1</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                    effectiveWarehouse === "FLOOR_1"
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-700"
                  }`}
                >
                  {totalStockFloor1.toLocaleString("vi-VN")}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveWarehouse("FLOOR_2")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 ${
                  effectiveWarehouse === "FLOOR_2"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Kho Tầng 2</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                    effectiveWarehouse === "FLOOR_2"
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-700"
                  }`}
                >
                  {totalStockFloor2.toLocaleString("vi-VN")}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveWarehouse("ALL")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 ${
                  effectiveWarehouse === "ALL"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Gộp 2 kho</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                    effectiveWarehouse === "ALL"
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-700"
                  }`}
                >
                  {totalStock.toLocaleString("vi-VN")}
                </span>
              </button>
            </div>
          )}
        </div>

        {canCreateProduct && (
          <button
            type="button"
            onClick={() => setShowCodeCreator(true)}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Tạo SP mới
          </button>
        )}
      </div>
    </div>
  );
}
