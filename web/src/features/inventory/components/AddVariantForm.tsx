import { Plus } from "lucide-react";
import { ColorInputWithPicker } from "@/shared/ui/ColorSwatchPicker";
import type { Product } from "@/shared/types";
import type { InventoryCtx } from "./inventoryCtx";

type Props = Pick<InventoryCtx, "setNewVariantDrafts" | "addingVariantProdId" | "handleAddVariantToProduct"> & { p: Product; draft: InventoryCtx["newVariantDrafts"][string] };

export default function AddVariantForm({ p, draft, setNewVariantDrafts, addingVariantProdId, handleAddVariantToProduct }: Props) {
  return (
        <div className="flex flex-wrap items-end gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Màu sắc mới (Chọn 1 hoặc nhiều màu)
            </label>
            <ColorInputWithPicker
              value={draft.color}
              colorHexes={draft.colorHexes}
              onChange={(nextColor, nextHexes) =>
                setNewVariantDrafts((prev) => ({
                  ...prev,
                  [p._id]: {
                    ...draft,
                    color: nextColor,
                    colorHexes: nextHexes,
                  },
                }))
              }
              placeholder="VD: Đỏ, Trắng/Đen..."
              className="w-48"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Size mới
            </label>
            <input
              type="text"
              value={draft.size}
              onChange={(e) =>
                setNewVariantDrafts((prev) => ({
                  ...prev,
                  [p._id]: { ...draft, size: e.target.value.toUpperCase() },
                }))
              }
              placeholder="VD: S, M, L, XL, 42..."
              className="px-2.5 py-1.5 rounded border border-slate-300 text-xs w-28 font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Số lượng nhập thêm
            </label>
            <input
              type="number"
              min={0}
              value={draft.quantity}
              onChange={(e) =>
                setNewVariantDrafts((prev) => ({
                  ...prev,
                  [p._id]: {
                    ...draft,
                    quantity: Math.max(0, Number(e.target.value) || 0),
                  },
                }))
              }
              className="px-2.5 py-1.5 rounded border border-slate-300 text-xs w-28 font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Kho tầng
            </label>
            <select
              value={draft.floor}
              onChange={(e) =>
                setNewVariantDrafts((prev) => ({
                  ...prev,
                  [p._id]: {
                    ...draft,
                    floor:
                      e.target.value === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1",
                  },
                }))
              }
              className="px-2.5 py-1.5 rounded border border-slate-300 text-xs bg-white"
            >
              <option value="FLOOR_1">🏢 Kho Tầng 1</option>
              <option value="FLOOR_2">🏬 Kho Tầng 2</option>
            </select>
          </div>
          <button
            type="button"
            disabled={addingVariantProdId === p._id}
            onClick={() => handleAddVariantToProduct(p)}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {addingVariantProdId === p._id
                ? "Đang thêm..."
                : "Thêm Size / Màu"}
            </span>
          </button>
        </div>
  );
}
