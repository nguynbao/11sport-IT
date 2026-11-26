import { Plus, Minus, Trash2 } from "lucide-react";
import { formatVND, formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { getExchangeItemPricing } from "../types";
import type { ReturnCtx } from "./returnCtx";

type Props = Pick<ReturnCtx, "exchangeRows" | "setExchangeRows" | "handleChangeExchangeDiscount" | "handleChangeExchangeDesiredPrice">;

export default function ExchangeCart({ exchangeRows, setExchangeRows, handleChangeExchangeDiscount, handleChangeExchangeDesiredPrice }: Props) {
  return (
    <>
    {exchangeRows.length === 0 ? (
      <div className="p-3 rounded-xl border border-dashed border-blue-300 bg-white/80 text-center text-xs text-slate-600">
        Chưa có sản phẩm đổi mới nào được chọn. Hãy gõ tìm sản phẩm ở ô phía trên và bấm{" "}
        <strong>+ Chọn đổi</strong>.
      </div>
    ) : (
      <>
        {/* Mobile: thẻ dọc không cuộn ngang */}
        <div className="md:hidden space-y-2.5">
          {exchangeRows.map((ex, i) => {
            const pricing = getExchangeItemPricing(ex);
            return (
              <div
                key={ex.optionKey}
                className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs leading-snug">
                      {ex.displayName}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                      {ex.variantCode || ex.product.code} · Tồn T1: {ex.stockFloor1}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExchangeRows((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                    title="Xóa dòng đổi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Đơn giá</div>
                    <div className="font-mono text-xs">
                      {pricing.discountPerUnit > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="line-through text-slate-400 text-[11px]">
                            {formatVND(pricing.originalUnitPrice)}
                          </span>
                          <span className="font-bold text-brand-ink">
                            {formatVND(pricing.unitPrice)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-bold text-slate-900">
                          {formatVND(pricing.originalUnitPrice)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={ex.quantity <= 1}
                      onClick={() =>
                        setExchangeRows((prev) =>
                          prev.map((r, idx) =>
                            idx === i ? { ...r, quantity: Math.max(1, r.quantity - 1) } : r
                          )
                        )
                      }
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white disabled:opacity-40"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={ex.stockFloor1}
                      value={ex.quantity}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      onChange={(e) => {
                        const val = Math.min(
                          ex.stockFloor1,
                          Math.max(1, Number(e.target.value) || 1)
                        );
                        setExchangeRows((prev) =>
                          prev.map((r, idx) => (idx === i ? { ...r, quantity: val } : r))
                        );
                      }}
                      className="w-12 h-8 px-1 rounded-lg border border-slate-300 text-center font-mono text-xs font-bold"
                    />
                    <button
                      type="button"
                      disabled={ex.quantity >= ex.stockFloor1}
                      onClick={() =>
                        setExchangeRows((prev) =>
                          prev.map((r, idx) =>
                            idx === i
                              ? { ...r, quantity: Math.min(ex.stockFloor1, r.quantity + 1) }
                              : r
                          )
                        )
                      }
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/70">
                  <div className={ex.discountType === "NONE" ? "col-span-2" : "col-span-1"}>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                      Hình thức giảm
                    </label>
                    <select
                      value={ex.discountType}
                      onChange={(e) => {
                        const val = e.target.value as "NONE" | "PERCENT" | "AMOUNT";
                        handleChangeExchangeDiscount(ex.optionKey, val, 0, val, "");
                      }}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                    >
                      <option value="NONE">Không giảm</option>
                      <option value="PERCENT">Giảm theo %</option>
                      <option value="AMOUNT">Giảm tiền (đ/SP)</option>
                    </select>
                  </div>

                  {ex.discountType === "PERCENT" && (
                    <div>
                      <label className="block text-[10px] font-bold text-rose-700 mb-0.5">
                        % giảm
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={ex.discountValue || ""}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        onChange={(e) =>
                          handleChangeExchangeDiscount(
                            ex.optionKey,
                            "PERCENT",
                            Number(e.target.value),
                            "PERCENT"
                          )
                        }
                        placeholder="0%"
                        className="w-full px-2 py-1.5 rounded-lg border border-rose-300 font-mono font-bold text-right text-xs bg-white"
                      />
                    </div>
                  )}

                  {ex.discountType === "AMOUNT" && ex.discountInputMode !== "PRICE" && (
                    <div>
                      <label className="block text-[10px] font-bold text-rose-700 mb-0.5">
                        Số tiền giảm/SP
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={ex.discountValue > 0 ? formatNumberDots(ex.discountValue) : ""}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        onChange={(e) =>
                          handleChangeExchangeDiscount(
                            ex.optionKey,
                            "AMOUNT",
                            parseNumberDots(e.target.value),
                            "AMOUNT"
                          )
                        }
                        placeholder="0 đ"
                        className="w-full px-2 py-1.5 rounded-lg border border-rose-300 font-mono font-bold text-right text-xs bg-white"
                      />
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                      Hoặc nhập giá muốn bán (đ/SP)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        ex.discountInputMode === "PRICE" && ex.customPriceText !== undefined
                          ? ex.customPriceText
                          : pricing.discountAmount > 0
                            ? formatNumberDots(pricing.unitPrice)
                            : ""
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      onChange={(e) =>
                        handleChangeExchangeDesiredPrice(ex.optionKey, e.target.value)
                      }
                      placeholder="Nhập giá muốn bán..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-blue-400 font-mono font-bold text-right text-xs bg-white text-blue-900 placeholder:font-sans placeholder:font-medium placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                  <span className="font-bold text-slate-600">Thành tiền:</span>
                  <div className="text-right font-mono font-extrabold text-slate-900">
                    <span>{formatVND(pricing.lineTotal)}</span>
                    {pricing.discountAmount > 0 && (
                      <span className="ml-1.5 text-[11px] font-bold text-rose-600">
                        (−{formatVND(pricing.discountAmount)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: bảng đầy đủ */}
        <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl bg-white max-w-full">
          <table className="w-full min-w-[780px] text-xs text-left">
          <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
            <tr>
              <th className="py-2.5 px-3">Sản phẩm đổi mới đã chọn</th>
              <th className="py-2.5 px-3 text-right">Đơn giá</th>
              <th className="py-2.5 px-3">Giảm giá / Nhập giá muốn bán</th>
              <th className="py-2.5 px-3 text-center w-36">Số lượng đổi</th>
              <th className="py-2.5 px-3 text-right">Thành tiền</th>
              <th className="py-2.5 px-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {exchangeRows.map((ex, i) => {
              const pricing = getExchangeItemPricing(ex);
              return (
                <tr key={ex.optionKey} className="align-top">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900">{ex.displayName}</div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {ex.variantCode || ex.product.code} · Tối đa khả dụng: {ex.stockFloor1}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {pricing.discountPerUnit > 0 ? (
                      <div>
                        <div className="line-through text-slate-400 text-[11px]">
                          {formatVND(pricing.originalUnitPrice)}
                        </div>
                        <div className="font-bold text-brand-ink">
                          {formatVND(pricing.unitPrice)}
                        </div>
                      </div>
                    ) : (
                      <span className="font-semibold">
                        {formatVND(pricing.originalUnitPrice)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-[260px]">
                      <select
                        value={ex.discountType}
                        onChange={(e) => {
                          const val = e.target.value as
                            | "NONE"
                            | "PERCENT"
                            | "AMOUNT";
                          handleChangeExchangeDiscount(
                            ex.optionKey,
                            val,
                            0,
                            val,
                            ""
                          );
                        }}
                        className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px] font-semibold"
                      >
                        <option value="NONE">Không giảm</option>
                        <option value="PERCENT">Giảm theo %</option>
                        <option value="AMOUNT">Giảm tiền (VND/SP)</option>
                      </select>

                      {ex.discountType === "PERCENT" && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={ex.discountValue || ""}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            onChange={(e) =>
                              handleChangeExchangeDiscount(
                                ex.optionKey,
                                "PERCENT",
                                Number(e.target.value),
                                "PERCENT"
                              )
                            }
                            placeholder="0"
                            className="w-16 px-2 py-1 rounded border border-rose-300 font-mono font-bold text-right text-xs bg-white"
                          />
                          <span className="font-bold text-rose-700">%</span>
                        </div>
                      )}

                      {ex.discountType === "AMOUNT" &&
                        ex.discountInputMode !== "PRICE" && (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={
                                ex.discountValue > 0
                                  ? formatNumberDots(ex.discountValue)
                                  : ""
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              onChange={(e) =>
                                handleChangeExchangeDiscount(
                                  ex.optionKey,
                                  "AMOUNT",
                                  parseNumberDots(e.target.value),
                                  "AMOUNT"
                                )
                              }
                              placeholder="Số tiền giảm"
                              className="w-28 px-2 py-1 rounded border border-rose-300 font-mono font-bold text-right text-xs bg-white"
                            />
                            <span className="font-bold text-rose-700 text-[10px]">
                              đ/SP
                            </span>
                          </div>
                        )}

                      {/* Ô input nhập giá muốn bán luôn hiển thị trực tiếp */}
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            ex.discountInputMode === "PRICE" &&
                              ex.customPriceText !== undefined
                              ? ex.customPriceText
                              : pricing.discountAmount > 0
                                ? formatNumberDots(pricing.unitPrice)
                                : ""
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.preventDefault();
                          }}
                          onChange={(e) =>
                            handleChangeExchangeDesiredPrice(
                              ex.optionKey,
                              e.target.value
                            )
                          }
                          placeholder="Nhập giá muốn bán"
                          className="w-36 px-2.5 py-1 rounded border border-blue-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-500 font-mono font-bold text-right text-xs bg-white text-blue-900 placeholder:font-sans placeholder:font-medium placeholder:text-slate-400"
                        />
                        <span className="text-[10px] font-bold text-slate-500">
                          đ/SP
                        </span>
                      </div>

                      {pricing.discountAmount > 0 && (
                        <span className="font-mono text-[11px] font-bold text-rose-600">
                          (−{formatVND(pricing.discountAmount)})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={ex.quantity <= 1}
                        onClick={() =>
                          setExchangeRows((prev) =>
                            prev.map((r, idx) =>
                              idx === i
                                ? { ...r, quantity: Math.max(1, r.quantity - 1) }
                                : r
                            )
                          )
                        }
                        className="w-8 h-9 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={ex.stockFloor1}
                        value={ex.quantity}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        onChange={(e) => {
                          const val = Math.min(
                            ex.stockFloor1,
                            Math.max(1, Number(e.target.value) || 1)
                          );
                          setExchangeRows((prev) =>
                            prev.map((r, idx) =>
                              idx === i ? { ...r, quantity: val } : r
                            )
                          );
                        }}
                        className="w-14 min-h-[36px] px-1.5 py-1 rounded border border-slate-300 text-center font-mono font-bold"
                      />
                      <button
                        type="button"
                        disabled={ex.quantity >= ex.stockFloor1}
                        onClick={() =>
                          setExchangeRows((prev) =>
                            prev.map((r, idx) =>
                              idx === i
                                ? {
                                  ...r,
                                  quantity: Math.min(ex.stockFloor1, r.quantity + 1),
                                }
                                : r
                            )
                          )
                        }
                        className="w-8 h-9 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-400 disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    <div>{formatVND(pricing.lineTotal)}</div>
                    {pricing.discountAmount > 0 && (
                      <div className="text-[11px] font-bold text-rose-600">
                        −{formatVND(pricing.discountAmount)}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        setExchangeRows((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                      className="w-9 h-9 inline-flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
                      title="Xóa dòng đổi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </>
    )}
    </>
  );
}
