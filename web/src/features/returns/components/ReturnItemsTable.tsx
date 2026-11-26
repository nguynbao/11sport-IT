import { Plus, Minus } from "lucide-react";
import { formatVND } from "@/shared/utils/format";
import type { ReturnCtx } from "./returnCtx";

type Props = Pick<ReturnCtx, "returnRows" | "setReturnRows" | "localCalc">;

export default function ReturnItemsTable({ returnRows, setReturnRows, localCalc }: Props) {
  const updateQty = (idx: number, nextQty: number) => {
    setReturnRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, quantity: Math.min(r.maxReturnable, Math.max(0, nextQty)) } : r
      )
    );
  };

  const updateCondition = (idx: number, condition: "GOOD" | "DAMAGED") => {
    setReturnRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, condition } : r))
    );
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-slate-900 text-sm">
          1. Chọn sản phẩm khách mang đổi &amp; Tình trạng hàng (GOOD / DAMAGED):
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setReturnRows((prev) =>
                prev.map((r) => ({ ...r, quantity: r.maxReturnable }))
              )
            }
            disabled={returnRows.every((r) => r.maxReturnable === 0)}
            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-brand-ink border border-blue-200 text-xs font-bold disabled:opacity-50"
          >
            Chọn đổi toàn bộ đơn
          </button>
          <button
            type="button"
            onClick={() =>
              setReturnRows((prev) => prev.map((r) => ({ ...r, quantity: 0 })))
            }
            disabled={returnRows.every((r) => r.quantity === 0)}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-50"
          >
            Đặt lại về 0
          </button>
        </div>
      </div>

      {/* Mobile (< md): Card dọc gọn gàng, không bị cắt cột */}
      <div className="md:hidden space-y-2.5">
        {returnRows.map((row, idx) => {
          const effUnit = localCalc.unitRefundPrices[idx] ?? row.unitPrice;
          const hasBillOrItemDisc =
            !row.isGift && Math.max(row.originalUnitPrice, row.unitPrice) > effUnit;
          const lineRefund =
            localCalc.lineRefundTotals[idx] ?? row.unitPrice * row.quantity;

          return (
            <div
              key={`${row.lineIndex}-${row.productId}-${row.color}-${row.size}`}
              className={`rounded-xl border p-3 space-y-2.5 text-xs ${
                row.quantity > 0
                  ? "bg-blue-50/40 border-blue-300"
                  : "bg-white border-slate-200"
              }`}
            >
              {/* Tên SP + Mã + Màu/Size */}
              <div className="space-y-1">
                <div className="font-bold text-slate-900 text-[13px] flex items-center gap-1.5 flex-wrap leading-snug">
                  <span>{row.productName}</span>
                  {row.isGift && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                      🎁 Hàng tặng
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                  <span>{row.productCode}</span>
                  {(row.color || row.size) && (
                    <span className="font-sans text-[11px] font-semibold text-brand-ink">
                      {[
                        row.color ? `Màu: ${row.color}` : "",
                        row.size ? `Size: ${row.size}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Giá bán + Còn có thể trả */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Giá bán
                  </span>
                  <div className="flex items-baseline gap-1.5 font-mono">
                    <span className="font-bold text-brand-ink">{formatVND(effUnit)}</span>
                    {hasBillOrItemDisc && (
                      <span className="line-through text-slate-400 text-[10px]">
                        {formatVND(Math.max(row.originalUnitPrice, row.unitPrice))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Có thể đổi
                  </span>
                  <span className="font-mono font-extrabold text-brand-ink">
                    {row.maxReturnable}
                  </span>
                </div>
              </div>

              {/* Số lượng đổi + Thành tiền hoàn */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-slate-200">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    disabled={row.quantity <= 0}
                    onClick={() => updateQty(idx, row.quantity - 1)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={row.maxReturnable}
                    disabled={row.maxReturnable === 0}
                    value={row.quantity}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    onChange={(e) => updateQty(idx, Number(e.target.value) || 0)}
                    className="w-12 h-8 px-1 rounded-lg border border-slate-300 text-center font-mono font-bold bg-white"
                  />
                  <button
                    type="button"
                    disabled={row.quantity >= row.maxReturnable}
                    onClick={() => updateQty(idx, row.quantity + 1)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-400 disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Tiền hoàn / đổi
                  </span>
                  <span className="font-mono font-extrabold text-sm text-slate-900">
                    {formatVND(lineRefund)}
                  </span>
                </div>
              </div>

              {/* Tình trạng hàng trả về */}
              <select
                disabled={row.quantity === 0}
                value={row.condition}
                onChange={(e) =>
                  updateCondition(idx, e.target.value as "GOOD" | "DAMAGED")
                }
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold disabled:opacity-50"
              >
                <option value="GOOD">Còn bán được (GOOD) — Cộng lại Kho</option>
                <option value="DAMAGED">Hỏng / Lỗi (DAMAGED) — Không cộng Kho</option>
              </select>
            </div>
          );
        })}
      </div>

      {/* Desktop (>= md): Bảng đầy đủ */}
      <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl max-w-full">
        <table className="w-full min-w-[840px] text-xs text-left">
          <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
            <tr>
              <th className="py-2.5 px-3">Sản phẩm trong đơn</th>
              <th className="py-2.5 px-3 text-right">Giá niêm yết / Giá bán</th>
              <th className="py-2.5 px-3 text-center">Còn có thể trả</th>
              <th className="py-2.5 px-3 text-center w-40">Số lượng trả</th>
              <th className="py-2.5 px-3 w-64">Tình trạng hàng trả về (BR-15)</th>
              <th className="py-2.5 px-3 text-right">Thành tiền hoàn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {returnRows.map((row, idx) => (
              <tr
                key={`${row.lineIndex}-${row.productId}-${row.color}-${row.size}`}
                className={row.quantity > 0 ? "bg-blue-50/40" : "hover:bg-slate-50"}
              >
                <td className="py-3 px-3">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>{row.productName}</span>
                    {row.isGift && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        🎁 Hàng tặng
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                    <span>{row.productCode}</span>
                    {(row.color || row.size) && (
                      <span className="font-sans text-[11px] font-semibold text-brand-ink">
                        {[
                          row.color ? `Màu: ${row.color}` : "",
                          row.size ? `Size: ${row.size}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3 text-right font-mono font-semibold">
                  {(() => {
                    const effUnit = localCalc.unitRefundPrices[idx] ?? row.unitPrice;
                    const hasBillOrItemDisc =
                      !row.isGift &&
                      Math.max(row.originalUnitPrice, row.unitPrice) > effUnit;
                    return (
                      <div>
                        {hasBillOrItemDisc && (
                          <div className="line-through text-slate-400 text-[11px]">
                            {formatVND(Math.max(row.originalUnitPrice, row.unitPrice))}
                          </div>
                        )}
                        <div className="font-bold text-brand-ink">{formatVND(effUnit)}</div>
                      </div>
                    );
                  })()}
                </td>
                <td className="py-3 px-3 text-center font-mono font-bold text-brand-ink">
                  {row.maxReturnable}
                </td>
                <td className="py-3 px-3 text-center">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={row.quantity <= 0}
                      onClick={() => updateQty(idx, row.quantity - 1)}
                      className="w-8 h-9 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={row.maxReturnable}
                      disabled={row.maxReturnable === 0}
                      value={row.quantity}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      onChange={(e) => updateQty(idx, Number(e.target.value) || 0)}
                      className="w-16 min-h-[36px] px-1.5 py-1 rounded border border-slate-300 text-center font-mono font-bold"
                    />
                    <button
                      type="button"
                      disabled={row.quantity >= row.maxReturnable}
                      onClick={() => updateQty(idx, row.quantity + 1)}
                      className="w-8 h-9 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-400 disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <select
                    disabled={row.quantity === 0}
                    value={row.condition}
                    onChange={(e) =>
                      updateCondition(idx, e.target.value as "GOOD" | "DAMAGED")
                    }
                    className="w-full min-h-[40px] px-2.5 py-1.5 rounded border border-slate-300 bg-white font-semibold"
                  >
                    <option value="GOOD">Còn bán được (GOOD) — Cộng lại Kho</option>
                    <option value="DAMAGED">Hỏng / Lỗi (DAMAGED) — Không cộng Kho</option>
                  </select>
                </td>
                <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900">
                  {formatVND(localCalc.lineRefundTotals[idx] ?? row.unitPrice * row.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
