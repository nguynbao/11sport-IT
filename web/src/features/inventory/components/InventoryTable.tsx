import type { Product } from "@/shared/types";
import InventoryRow, { type InventoryRowShared } from "./InventoryRow";
import type { InventoryCtx } from "./inventoryCtx";

type Props = Pick<InventoryCtx, "loading" | "displayedProducts"> & InventoryRowShared & { pagedProducts: Product[] };

export default function InventoryTable({ loading, displayedProducts, pagedProducts, ...rowShared }: Props) {
  const { colCount, effectiveWarehouse, canSeeCostPrice } = rowShared;

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-full">
      <table className="w-full min-w-[920px] text-sm text-left">
        <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 text-xs uppercase">
          <tr>
            <th className="py-3 px-3 w-10">STT</th>
            <th className="py-3 px-3">Mã SP (chung)</th>
            <th className="py-3 px-3">Tên hàng hóa</th>
            <th className="py-3 px-3">Phân loại (Màu sắc • Size : SL)</th>
            <th className="py-3 px-3">Danh mục</th>
            <th className="py-3 px-2 text-center">ĐVT</th>
            {(effectiveWarehouse === "FLOOR_1" || effectiveWarehouse === "ALL") && (
              <th className="py-3 px-3 text-right text-blue-300">🏢 Tầng 1</th>
            )}
            {(effectiveWarehouse === "FLOOR_2" || effectiveWarehouse === "ALL") && (
              <th className="py-3 px-3 text-right text-blue-300">🏬 Tầng 2</th>
            )}
            {effectiveWarehouse === "ALL" && (
              <th className="py-3 px-3 text-right">Tổng 2 Kho</th>
            )}
            {canSeeCostPrice && (
              <th className="py-3 px-3 text-right">Giá vốn</th>
            )}
            <th className="py-3 px-3 text-right">Giá niêm yết</th>
            <th className="py-3 px-3 text-center">Tem Label</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
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
