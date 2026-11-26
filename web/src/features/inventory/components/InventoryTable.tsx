import type { Product } from "@/shared/types";
import InventoryRow, { type InventoryRowShared } from "./InventoryRow";
import type { InventoryCtx } from "./inventoryCtx";

type Props = Pick<InventoryCtx, "loading" | "displayedProducts"> & InventoryRowShared & { pagedProducts: Product[] };

export default function InventoryTable({ loading, displayedProducts, pagedProducts, ...rowShared }: Props) {
  const { colCount, effectiveWarehouse, canSeeCostPrice } = rowShared;

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white max-w-full">
      <table className="w-full min-w-[920px] text-xs text-left">
        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider">
          <tr>
            <th className="py-3 px-3 w-10">STT</th>
            <th className="py-3 px-3">Mã SP (chung)</th>
            <th className="py-3 px-3">Tên hàng hóa</th>
            <th className="py-3 px-3">Phân loại (Màu sắc • Size : SL)</th>
            <th className="py-3 px-3">Danh mục</th>
            <th className="py-3 px-2 text-center">ĐVT</th>
            {(effectiveWarehouse === "FLOOR_1" || effectiveWarehouse === "ALL") && (
              <th className="py-3 px-3 text-right whitespace-nowrap text-brand-ink">Tồn Tầng 1</th>
            )}
            {(effectiveWarehouse === "FLOOR_2" || effectiveWarehouse === "ALL") && (
              <th className="py-3 px-3 text-right whitespace-nowrap text-purple-700">Tồn Tầng 2</th>
            )}
            {effectiveWarehouse === "ALL" && (
              <th className="py-3 px-3 text-right whitespace-nowrap text-slate-700">Tổng 2 Kho</th>
            )}
            {canSeeCostPrice && (
              <th className="py-3 px-3 text-right whitespace-nowrap">Giá vốn</th>
            )}
            <th className="py-3 px-3 text-right whitespace-nowrap">Giá niêm yết</th>
            <th className="py-3 px-3 text-center whitespace-nowrap">Tem Label</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={colCount} className="py-10 text-center text-slate-500">
                Đang tải dữ liệu tồn kho...
              </td>
            </tr>
          ) : displayedProducts.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="py-10 text-center text-slate-500">
                Không có mặt hàng nào khớp bộ lọc.
              </td>
            </tr>
          ) : (
            pagedProducts.map((p, idx) => (
              <InventoryRow key={p._id} p={p} idx={idx} {...rowShared} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
